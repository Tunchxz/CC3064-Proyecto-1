#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <signal.h>
#include <pthread.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <time.h>

#include "protocolo.h"
#include "server/client_list.h"
#include "server/server_handlers.h"

/* ── Per-client thread ── */
static void *client_thread(void *arg) {
    int sockfd = *(int *)arg;
    free(arg);
    pthread_detach(pthread_self());

    ChatPacket pkt;
    char username[32] = {0};

    while (1) {
        if (recv_packet(sockfd, &pkt) != 0)
            break; /* disconnect or error */

        /* Update activity timestamp; reactivate if was INACTIVE */
        if (cl_touch(sockfd)) {
            ChatPacket notif;
            memset(&notif, 0, sizeof(notif));
            notif.command = CMD_MSG;
            strncpy(notif.sender, "SERVER", 31);
            strncpy(notif.payload, "Tu status volvió a ACTIVE", 956);
            notif.payload_len = (uint16_t)strlen(notif.payload);
            send_packet(sockfd, &notif);
            printf("[SERVER] %s reactivado a ACTIVE\n", pkt.sender);
        }

        switch (pkt.command) {
        case CMD_REGISTER:
            /* client_ip was stored during accept; retrieve from list after add.
               Here we handle it in accept below, so register is called from there. */
            break;
        case CMD_BROADCAST:
            handle_broadcast(sockfd, &pkt);
            break;
        case CMD_DIRECT:
            handle_direct(sockfd, &pkt);
            break;
        case CMD_LIST:
            handle_list(sockfd, &pkt);
            break;
        case CMD_INFO:
            handle_info(sockfd, &pkt);
            break;
        case CMD_STATUS:
            handle_status(sockfd, &pkt);
            break;
        case CMD_LOGOUT:
            strncpy(username, pkt.sender, 31);
            handle_logout(sockfd, &pkt);
            goto cleanup;
        default:
            fprintf(stderr, "[SERVER] Comando desconocido: %d\n", pkt.command);
            break;
        }
    }

cleanup:
    /* Resolve username if we haven't from logout */
    if (username[0] == '\0') {
        pthread_mutex_lock(&mutex_lista);
        int idx = cl_find_by_fd(sockfd);
        if (idx >= 0)
            strncpy(username, lista[idx].username, 31);
        pthread_mutex_unlock(&mutex_lista);
    }

    cl_remove(sockfd);
    close(sockfd);

    if (username[0] != '\0') {
        printf("[SERVER] Sesión cerrada: %s\n", username);
        notify_disconnect(username);
    }
    return NULL;
}

/* ── Inactivity monitor thread ── */
static void *inactivity_thread(void *arg) {
    (void)arg;
    while (1) {
        sleep(10); /* check every 10 seconds */
        time_t now = time(NULL);

        pthread_mutex_lock(&mutex_lista);
        for (int i = 0; i < num_clientes; i++) {
            if (!lista[i].activo) continue;
            if (strcmp(lista[i].status, STATUS_INACTIVO) == 0) continue;

            if (difftime(now, lista[i].ultimo_mensaje) >= INACTIVITY_TIMEOUT) {
                strncpy(lista[i].status, STATUS_INACTIVO, 15);
                printf("[SERVER] %s marcado como INACTIVE por inactividad\n",
                       lista[i].username);

                /* Notify the client */
                ChatPacket pkt;
                memset(&pkt, 0, sizeof(pkt));
                pkt.command = CMD_MSG;
                strncpy(pkt.sender, "SERVER", 31);
                strncpy(pkt.target, lista[i].username, 31);
                strncpy(pkt.payload, "Tu status cambió a INACTIVE", 956);
                pkt.payload_len = (uint16_t)strlen(pkt.payload);
                send_packet(lista[i].sockfd, &pkt);
            }
        }
        pthread_mutex_unlock(&mutex_lista);
    }
    return NULL;
}

/* ── Main ── */
int main(int argc, char *argv[]) {
    if (argc != 2) {
        fprintf(stderr, "Uso: %s <puerto>\n", argv[0]);
        return EXIT_FAILURE;
    }

    signal(SIGPIPE, SIG_IGN);

    int port = atoi(argv[1]);
    cl_init();

    /* Create listen socket */
    int listen_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (listen_fd < 0) { perror("socket"); return EXIT_FAILURE; }

    int opt = 1;
    setsockopt(listen_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

    struct sockaddr_in srv_addr;
    memset(&srv_addr, 0, sizeof(srv_addr));
    srv_addr.sin_family      = AF_INET;
    srv_addr.sin_addr.s_addr = INADDR_ANY;
    srv_addr.sin_port        = htons((uint16_t)port);

    if (bind(listen_fd, (struct sockaddr *)&srv_addr, sizeof(srv_addr)) < 0) {
        perror("bind"); close(listen_fd); return EXIT_FAILURE;
    }
    if (listen(listen_fd, 10) < 0) {
        perror("listen"); close(listen_fd); return EXIT_FAILURE;
    }

    printf("=== Servidor de chat iniciado en puerto %d ===\n", port);

    /* Start inactivity monitor */
    pthread_t inact_tid;
    pthread_create(&inact_tid, NULL, inactivity_thread, NULL);

    /* Accept loop */
    while (1) {
        struct sockaddr_in cli_addr;
        socklen_t cli_len = sizeof(cli_addr);
        int client_fd = accept(listen_fd, (struct sockaddr *)&cli_addr, &cli_len);
        if (client_fd < 0) { perror("accept"); continue; }

        char client_ip[INET_ADDRSTRLEN];
        inet_ntop(AF_INET, &cli_addr.sin_addr, client_ip, sizeof(client_ip));
        printf("[SERVER] Nueva conexión desde %s\n", client_ip);

        /* Wait for the first packet: must be CMD_REGISTER */
        ChatPacket reg_pkt;
        if (recv_packet(client_fd, &reg_pkt) != 0 || reg_pkt.command != CMD_REGISTER) {
            fprintf(stderr, "[SERVER] Primer paquete no es REGISTER, cerrando conexión\n");
            close(client_fd);
            continue;
        }

        handle_register(client_fd, &reg_pkt, client_ip);

        /* Check if registration succeeded (client is now in the list) */
        pthread_mutex_lock(&mutex_lista);
        int idx = cl_find_by_fd(client_fd);
        pthread_mutex_unlock(&mutex_lista);

        if (idx < 0) {
            /* Registration failed — client was sent an error, close */
            close(client_fd);
            continue;
        }

        /* Spawn thread for this client */
        int *fd_ptr = malloc(sizeof(int));
        *fd_ptr = client_fd;
        pthread_t tid;
        pthread_create(&tid, NULL, client_thread, fd_ptr);
    }

    close(listen_fd);
    return 0;
}

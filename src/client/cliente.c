#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <signal.h>
#include <pthread.h>

#include "protocolo.h"
#include "client/client_net.h"
#include "client/client_ui.h"

static volatile int running = 1;

/* ── Receiver thread: reads packets from server and displays them ── */
static void *recv_thread(void *arg) {
    int sockfd = *(int *)arg;
    ChatPacket pkt;

    while (running) {
        if (net_recv(sockfd, &pkt) != 0) {
            if (running) {
                printf("\n[!] Conexión con el servidor perdida.\n");
                running = 0;
            }
            break;
        }
        ui_display_packet(&pkt);
        printf("> ");
        fflush(stdout);
    }
    return NULL;
}

int main(int argc, char *argv[]) {
    if (argc != 4) {
        fprintf(stderr, "Uso: %s <usuario> <IP_servidor> <puerto>\n", argv[0]);
        return EXIT_FAILURE;
    }

    signal(SIGPIPE, SIG_IGN);

    const char *username  = argv[1];
    const char *server_ip = argv[2];
    int port = atoi(argv[3]);

    if (strlen(username) > 31) {
        fprintf(stderr, "El nombre de usuario no puede exceder 31 caracteres.\n");
        return EXIT_FAILURE;
    }

    /* Connect to server */
    int sockfd = net_connect(server_ip, port);
    if (sockfd < 0) {
        fprintf(stderr, "No se pudo conectar al servidor %s:%d\n", server_ip, port);
        return EXIT_FAILURE;
    }

    /* Send registration */
    net_register(sockfd, username);

    /* Wait for registration response */
    ChatPacket resp;
    if (net_recv(sockfd, &resp) != 0) {
        fprintf(stderr, "Error al recibir respuesta del servidor.\n");
        close(sockfd);
        return EXIT_FAILURE;
    }

    if (resp.command == CMD_ERROR) {
        printf("[ERROR] %s\n", resp.payload);
        close(sockfd);
        return EXIT_FAILURE;
    }

    ui_display_packet(&resp);
    printf("Conectado como '%s'. Escribe /help para ver comandos.\n\n", username);

    /* Start receiver thread */
    pthread_t tid;
    pthread_create(&tid, NULL, recv_thread, &sockfd);

    /* Input loop */
    char line[1024];
    while (running) {
        printf("> ");
        fflush(stdout);

        if (fgets(line, sizeof(line), stdin) == NULL)
            break;

        /* Strip trailing newline */
        size_t len = strlen(line);
        if (len > 0 && line[len - 1] == '\n')
            line[len - 1] = '\0';

        if (ui_process_input(line, sockfd, username) < 0)
            break;
    }

    running = 0;
    /* Brief wait for logout response, then close */
    usleep(200000);
    close(sockfd);
    pthread_cancel(tid);
    pthread_join(tid, NULL);

    printf("¡Hasta luego!\n");
    return 0;
}

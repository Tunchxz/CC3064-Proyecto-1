#include "server_handlers.h"
#include "client_list.h"
#include <string.h>
#include <stdio.h>
#include <unistd.h>
#include <sys/socket.h>
#include <errno.h>

/* ── Helpers ── */

int send_packet(int sockfd, const ChatPacket *pkt) {
    size_t total = 0;
    const char *buf = (const char *)pkt;
    while (total < sizeof(ChatPacket)) {
        ssize_t n = send(sockfd, buf + total, sizeof(ChatPacket) - total, 0);
        if (n <= 0) return -1;
        total += (size_t)n;
    }
    return 0;
}

int recv_packet(int sockfd, ChatPacket *pkt) {
    size_t total = 0;
    char *buf = (char *)pkt;
    while (total < sizeof(ChatPacket)) {
        ssize_t n = recv(sockfd, buf + total, sizeof(ChatPacket) - total, 0);
        if (n <= 0) return -1;
        total += (size_t)n;
    }
    return 0;
}

static void send_ok(int sockfd, const char *target, const char *msg) {
    ChatPacket resp;
    memset(&resp, 0, sizeof(resp));
    resp.command = CMD_OK;
    strncpy(resp.sender, "SERVER", 31);
    strncpy(resp.target, target, 31);
    strncpy(resp.payload, msg, 956);
    resp.payload_len = (uint16_t)strlen(resp.payload);
    send_packet(sockfd, &resp);
}

static void send_error(int sockfd, const char *target, const char *msg) {
    ChatPacket resp;
    memset(&resp, 0, sizeof(resp));
    resp.command = CMD_ERROR;
    strncpy(resp.sender, "SERVER", 31);
    strncpy(resp.target, target, 31);
    strncpy(resp.payload, msg, 956);
    resp.payload_len = (uint16_t)strlen(resp.payload);
    send_packet(sockfd, &resp);
}

/* ── Command Handlers ── */

void handle_register(int sockfd, const ChatPacket *pkt, const char *client_ip) {
    int rc = cl_add(pkt->sender, client_ip, sockfd);
    if (rc == 0) {
        char msg[64];
        snprintf(msg, sizeof(msg), "Bienvenido %s", pkt->sender);
        send_ok(sockfd, pkt->sender, msg);
        printf("[SERVER] Usuario registrado: %s (%s)\n", pkt->sender, client_ip);
    } else if (rc == -1) {
        send_error(sockfd, pkt->sender, "Usuario ya existe");
    } else {
        send_error(sockfd, pkt->sender, "Servidor lleno");
    }
}

void handle_broadcast(int sockfd, const ChatPacket *pkt) {
    (void)sockfd;
    ChatPacket msg;
    memset(&msg, 0, sizeof(msg));
    msg.command = CMD_MSG;
    strncpy(msg.sender, pkt->sender, 31);
    strncpy(msg.target, "ALL", 31);
    strncpy(msg.payload, pkt->payload, 956);
    msg.payload_len = pkt->payload_len;

    pthread_mutex_lock(&mutex_lista);
    for (int i = 0; i < num_clientes; i++) {
        if (lista[i].activo) {
            send_packet(lista[i].sockfd, &msg);
        }
    }
    pthread_mutex_unlock(&mutex_lista);
}

void handle_direct(int sockfd, const ChatPacket *pkt) {
    ChatPacket msg;
    memset(&msg, 0, sizeof(msg));
    msg.command = CMD_MSG;
    strncpy(msg.sender, pkt->sender, 31);
    strncpy(msg.target, pkt->target, 31);
    strncpy(msg.payload, pkt->payload, 956);
    msg.payload_len = pkt->payload_len;

    pthread_mutex_lock(&mutex_lista);
    int idx = cl_find_by_name(pkt->target);
    if (idx >= 0) {
        send_packet(lista[idx].sockfd, &msg);
        pthread_mutex_unlock(&mutex_lista);
    } else {
        pthread_mutex_unlock(&mutex_lista);
        send_error(sockfd, pkt->sender, "Destinatario no conectado");
    }
}

void handle_list(int sockfd, const ChatPacket *pkt) {
    ChatPacket resp;
    memset(&resp, 0, sizeof(resp));
    resp.command = CMD_USER_LIST;
    strncpy(resp.sender, "SERVER", 31);
    strncpy(resp.target, pkt->sender, 31);
    cl_build_list(resp.payload, sizeof(resp.payload));
    resp.payload_len = (uint16_t)strlen(resp.payload);
    send_packet(sockfd, &resp);
}

void handle_info(int sockfd, const ChatPacket *pkt) {
    char info[128];
    if (cl_get_info(pkt->target, info, sizeof(info)) == 0) {
        ChatPacket resp;
        memset(&resp, 0, sizeof(resp));
        resp.command = CMD_USER_INFO;
        strncpy(resp.sender, "SERVER", 31);
        strncpy(resp.target, pkt->sender, 31);
        strncpy(resp.payload, info, 956);
        resp.payload_len = (uint16_t)strlen(resp.payload);
        send_packet(sockfd, &resp);
    } else {
        send_error(sockfd, pkt->sender, "Usuario no conectado");
    }
}

void handle_status(int sockfd, const ChatPacket *pkt) {
    if (cl_set_status(pkt->sender, pkt->payload) == 0) {
        send_ok(sockfd, pkt->sender, pkt->payload);
        printf("[SERVER] %s cambió status a %s\n", pkt->sender, pkt->payload);
    } else {
        send_error(sockfd, pkt->sender, "No se pudo cambiar status");
    }
}

void handle_logout(int sockfd, const ChatPacket *pkt) {
    send_ok(sockfd, pkt->sender, "Desconectado");
    printf("[SERVER] Usuario desconectado: %s\n", pkt->sender);
}

void notify_disconnect(const char *username) {
    ChatPacket pkt;
    memset(&pkt, 0, sizeof(pkt));
    pkt.command = CMD_DISCONNECTED;
    strncpy(pkt.sender, "SERVER", 31);
    strncpy(pkt.target, "ALL", 31);
    strncpy(pkt.payload, username, 956);
    pkt.payload_len = (uint16_t)strlen(pkt.payload);

    pthread_mutex_lock(&mutex_lista);
    for (int i = 0; i < num_clientes; i++) {
        if (lista[i].activo) {
            send_packet(lista[i].sockfd, &pkt);
        }
    }
    pthread_mutex_unlock(&mutex_lista);
}

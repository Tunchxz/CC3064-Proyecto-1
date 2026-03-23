#include "client_net.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>

int net_connect(const char *ip, int port) {
    int sockfd = socket(AF_INET, SOCK_STREAM, 0);
    if (sockfd < 0) { perror("socket"); return -1; }

    struct sockaddr_in addr;
    memset(&addr, 0, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_port   = htons((uint16_t)port);

    if (inet_pton(AF_INET, ip, &addr.sin_addr) <= 0) {
        fprintf(stderr, "Dirección IP inválida: %s\n", ip);
        close(sockfd);
        return -1;
    }

    if (connect(sockfd, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        perror("connect");
        close(sockfd);
        return -1;
    }

    return sockfd;
}

int net_send(int sockfd, const ChatPacket *pkt) {
    size_t total = 0;
    const char *buf = (const char *)pkt;
    while (total < sizeof(ChatPacket)) {
        ssize_t n = send(sockfd, buf + total, sizeof(ChatPacket) - total, 0);
        if (n <= 0) return -1;
        total += (size_t)n;
    }
    return 0;
}

int net_recv(int sockfd, ChatPacket *pkt) {
    size_t total = 0;
    char *buf = (char *)pkt;
    while (total < sizeof(ChatPacket)) {
        ssize_t n = recv(sockfd, buf + total, sizeof(ChatPacket) - total, 0);
        if (n <= 0) return -1;
        total += (size_t)n;
    }
    return 0;
}

/* ── Packet builders ── */

void net_register(int sockfd, const char *username) {
    ChatPacket pkt;
    memset(&pkt, 0, sizeof(pkt));
    pkt.command = CMD_REGISTER;
    strncpy(pkt.sender, username, 31);
    strncpy(pkt.payload, username, 956);
    pkt.payload_len = (uint16_t)strlen(pkt.payload);
    net_send(sockfd, &pkt);
}

void net_broadcast(int sockfd, const char *username, const char *message) {
    ChatPacket pkt;
    memset(&pkt, 0, sizeof(pkt));
    pkt.command = CMD_BROADCAST;
    strncpy(pkt.sender, username, 31);
    strncpy(pkt.payload, message, 956);
    pkt.payload_len = (uint16_t)strlen(pkt.payload);
    net_send(sockfd, &pkt);
}

void net_direct(int sockfd, const char *username, const char *target, const char *message) {
    ChatPacket pkt;
    memset(&pkt, 0, sizeof(pkt));
    pkt.command = CMD_DIRECT;
    strncpy(pkt.sender, username, 31);
    strncpy(pkt.target, target, 31);
    strncpy(pkt.payload, message, 956);
    pkt.payload_len = (uint16_t)strlen(pkt.payload);
    net_send(sockfd, &pkt);
}

void net_list(int sockfd, const char *username) {
    ChatPacket pkt;
    memset(&pkt, 0, sizeof(pkt));
    pkt.command = CMD_LIST;
    strncpy(pkt.sender, username, 31);
    net_send(sockfd, &pkt);
}

void net_info(int sockfd, const char *username, const char *target) {
    ChatPacket pkt;
    memset(&pkt, 0, sizeof(pkt));
    pkt.command = CMD_INFO;
    strncpy(pkt.sender, username, 31);
    strncpy(pkt.target, target, 31);
    net_send(sockfd, &pkt);
}

void net_status(int sockfd, const char *username, const char *new_status) {
    ChatPacket pkt;
    memset(&pkt, 0, sizeof(pkt));
    pkt.command = CMD_STATUS;
    strncpy(pkt.sender, username, 31);
    strncpy(pkt.payload, new_status, 956);
    pkt.payload_len = (uint16_t)strlen(pkt.payload);
    net_send(sockfd, &pkt);
}

void net_logout(int sockfd, const char *username) {
    ChatPacket pkt;
    memset(&pkt, 0, sizeof(pkt));
    pkt.command = CMD_LOGOUT;
    strncpy(pkt.sender, username, 31);
    net_send(sockfd, &pkt);
}

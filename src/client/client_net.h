#ifndef CLIENT_NET_H
#define CLIENT_NET_H

#include "protocolo.h"

/* Connect to server. Returns socket fd or -1 on error. */
int net_connect(const char *ip, int port);

/* Send a full ChatPacket. Returns 0 on success, -1 on error. */
int net_send(int sockfd, const ChatPacket *pkt);

/* Receive a full ChatPacket. Returns 0 on success, -1 on disconnect/error. */
int net_recv(int sockfd, ChatPacket *pkt);

/* Build and send a CMD_REGISTER packet. */
void net_register(int sockfd, const char *username);

/* Build and send a CMD_BROADCAST packet. */
void net_broadcast(int sockfd, const char *username, const char *message);

/* Build and send a CMD_DIRECT packet. */
void net_direct(int sockfd, const char *username, const char *target, const char *message);

/* Build and send a CMD_LIST packet. */
void net_list(int sockfd, const char *username);

/* Build and send a CMD_INFO packet. */
void net_info(int sockfd, const char *username, const char *target);

/* Build and send a CMD_STATUS packet. */
void net_status(int sockfd, const char *username, const char *new_status);

/* Build and send a CMD_LOGOUT packet. */
void net_logout(int sockfd, const char *username);

#endif

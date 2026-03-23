#ifndef SERVER_HANDLERS_H
#define SERVER_HANDLERS_H

#include "protocolo.h"

/* Send a packet reliably (full 1024 bytes). Returns 0 on success. */
int send_packet(int sockfd, const ChatPacket *pkt);

/* Receive a packet reliably (full 1024 bytes). Returns 0 on success, -1 on disconnect/error. */
int recv_packet(int sockfd, ChatPacket *pkt);

/* Handle CMD_REGISTER */
void handle_register(int sockfd, const ChatPacket *pkt, const char *client_ip);

/* Handle CMD_BROADCAST */
void handle_broadcast(int sockfd, const ChatPacket *pkt);

/* Handle CMD_DIRECT */
void handle_direct(int sockfd, const ChatPacket *pkt);

/* Handle CMD_LIST */
void handle_list(int sockfd, const ChatPacket *pkt);

/* Handle CMD_INFO */
void handle_info(int sockfd, const ChatPacket *pkt);

/* Handle CMD_STATUS */
void handle_status(int sockfd, const ChatPacket *pkt);

/* Handle CMD_LOGOUT — notify all others. */
void handle_logout(int sockfd, const ChatPacket *pkt);

/* Notify all connected clients that a user disconnected. */
void notify_disconnect(const char *username);

#endif

#ifndef CLIENT_UI_H
#define CLIENT_UI_H

#include "protocolo.h"

/* Display an incoming packet to the user. */
void ui_display_packet(const ChatPacket *pkt);

/* Show help text. */
void ui_show_help(void);

/* Parse and execute a user command. Returns 0 to continue, -1 to exit. */
int ui_process_input(const char *line, int sockfd, const char *username);

#endif

#include "client_ui.h"
#include "client/client_net.h"
#include <stdio.h>
#include <string.h>
#include <strings.h>

/* ── Colors for terminal output ── */
#define RESET   "\033[0m"
#define GREEN   "\033[32m"
#define CYAN    "\033[36m"
#define YELLOW  "\033[33m"
#define RED     "\033[31m"
#define BOLD    "\033[1m"

void ui_display_packet(const ChatPacket *pkt) {
    switch (pkt->command) {
    case CMD_OK:
        printf(GREEN "[OK] %s" RESET "\n", pkt->payload);
        break;
    case CMD_ERROR:
        printf(RED "[ERROR] %s" RESET "\n", pkt->payload);
        break;
    case CMD_MSG:
        if (strcmp(pkt->sender, "SERVER") == 0) {
            printf(YELLOW "[SERVER] %s" RESET "\n", pkt->payload);
        } else if (strcmp(pkt->target, "ALL") == 0) {
            printf(BOLD "[%s]" RESET " %s\n", pkt->sender, pkt->payload);
        } else {
            printf(CYAN "[DM de %s]" RESET " %s\n", pkt->sender, pkt->payload);
        }
        break;
    case CMD_USER_LIST:
        printf(BOLD "\n--- Usuarios conectados ---" RESET "\n");
        {
            /* Parse "alice,ACTIVE;bob,BUSY;..." */
            char buf[957];
            strncpy(buf, pkt->payload, 956);
            buf[956] = '\0';
            char *saveptr1;
            char *entry = strtok_r(buf, ";", &saveptr1);
            while (entry) {
                char *comma = strchr(entry, ',');
                if (comma) {
                    *comma = '\0';
                    printf("  %-20s [%s]\n", entry, comma + 1);
                } else {
                    printf("  %s\n", entry);
                }
                entry = strtok_r(NULL, ";", &saveptr1);
            }
        }
        printf(BOLD "----------------------------" RESET "\n");
        break;
    case CMD_USER_INFO:
        printf(BOLD "\n--- Info de usuario ---" RESET "\n");
        {
            /* Parse "IP,STATUS" */
            char buf[957];
            strncpy(buf, pkt->payload, 956);
            buf[956] = '\0';
            char *comma = strchr(buf, ',');
            if (comma) {
                *comma = '\0';
                printf("  IP:     %s\n", buf);
                printf("  Status: %s\n", comma + 1);
            } else {
                printf("  %s\n", buf);
            }
        }
        printf(BOLD "-----------------------" RESET "\n");
        break;
    case CMD_DISCONNECTED:
        printf(YELLOW "[SERVER] %s se ha desconectado" RESET "\n", pkt->payload);
        break;
    default:
        printf("[?] Paquete desconocido (cmd=%d)\n", pkt->command);
        break;
    }
    fflush(stdout);
}

void ui_show_help(void) {
    printf(BOLD "\n=== Comandos disponibles ===" RESET "\n");
    printf("  /broadcast <mensaje>            - Enviar mensaje a todos\n");
    printf("  /msg <usuario> <mensaje>        - Mensaje directo\n");
    printf("  /status <ACTIVE|BUSY|INACTIVE>  - Cambiar status\n");
    printf("  /list                           - Listar usuarios conectados\n");
    printf("  /info <usuario>                 - Info de un usuario\n");
    printf("  /help                           - Mostrar esta ayuda\n");
    printf("  /exit                           - Salir del chat\n");
    printf(BOLD "=============================" RESET "\n\n");
}

int ui_process_input(const char *line, int sockfd, const char *username) {
    /* Skip leading whitespace */
    while (*line == ' ' || *line == '\t') line++;

    if (line[0] == '\0' || line[0] == '\n')
        return 0;

    if (strncmp(line, "/broadcast ", 11) == 0) {
        const char *msg = line + 11;
        if (*msg != '\0' && *msg != '\n')
            net_broadcast(sockfd, username, msg);
        else
            printf("Uso: /broadcast <mensaje>\n");
    }
    else if (strncmp(line, "/msg ", 5) == 0) {
        char target[32];
        const char *rest = line + 5;
        /* Extract target username */
        int i = 0;
        while (*rest && *rest != ' ' && i < 31) {
            target[i++] = *rest++;
        }
        target[i] = '\0';
        if (*rest == ' ') rest++;
        if (target[0] != '\0' && *rest != '\0' && *rest != '\n')
            net_direct(sockfd, username, target, rest);
        else
            printf("Uso: /msg <usuario> <mensaje>\n");
    }
    else if (strncmp(line, "/status ", 8) == 0) {
        const char *st = line + 8;
        /* Trim trailing newline */
        char status_buf[16] = {0};
        int i = 0;
        while (*st && *st != '\n' && *st != ' ' && i < 15) {
            status_buf[i++] = *st++;
        }
        status_buf[i] = '\0';

        if (strcasecmp(status_buf, "ACTIVE") == 0 ||
            strcasecmp(status_buf, "BUSY") == 0 ||
            strcasecmp(status_buf, "INACTIVE") == 0) {
            /* Normalize to uppercase */
            for (int j = 0; status_buf[j]; j++) {
                if (status_buf[j] >= 'a' && status_buf[j] <= 'z')
                    status_buf[j] -= 32;
            }
            net_status(sockfd, username, status_buf);
        } else {
            printf("Status inválido. Usa: ACTIVE, BUSY o INACTIVE\n");
        }
    }
    else if (strncmp(line, "/list", 5) == 0) {
        net_list(sockfd, username);
    }
    else if (strncmp(line, "/info ", 6) == 0) {
        char target[32] = {0};
        const char *rest = line + 6;
        int i = 0;
        while (*rest && *rest != '\n' && *rest != ' ' && i < 31) {
            target[i++] = *rest++;
        }
        target[i] = '\0';
        if (target[0] != '\0')
            net_info(sockfd, username, target);
        else
            printf("Uso: /info <usuario>\n");
    }
    else if (strncmp(line, "/help", 5) == 0) {
        ui_show_help();
    }
    else if (strncmp(line, "/exit", 5) == 0) {
        net_logout(sockfd, username);
        return -1;
    }
    else {
        printf("Comando no reconocido. Escribe /help para ver los comandos.\n");
    }

    return 0;
}

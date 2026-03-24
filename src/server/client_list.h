#ifndef CLIENT_LIST_H
#define CLIENT_LIST_H

#include <pthread.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <time.h>

#define MAX_CLIENTS 100

typedef struct {
    char username[32];
    char ip[INET_ADDRSTRLEN];
    char status[16];
    int  sockfd;
    int  activo;
    time_t ultimo_mensaje;
} Cliente;

/* Global shared state */
extern Cliente      lista[MAX_CLIENTS];
extern int          num_clientes;
extern pthread_mutex_t mutex_lista;

/* Initialize the client list */
void cl_init(void);

/* Add a client. Returns 0 on success, -1 if name/IP already taken, -2 if full. */
int cl_add(const char *username, const char *ip, int sockfd);

/* Remove a client by socket fd. Returns 0 on success, -1 if not found. */
int cl_remove(int sockfd);

/* Find a client by username. Returns index or -1. Caller must hold mutex. */
int cl_find_by_name(const char *username);

/* Find a client by socket fd. Returns index or -1. Caller must hold mutex. */
int cl_find_by_fd(int sockfd);

/* Update status. Returns 0 on success, -1 if not found. */
int cl_set_status(const char *username, const char *new_status);

/* Build user list string: "alice,ACTIVE;bob,BUSY;..." into buf (max buflen). */
void cl_build_list(char *buf, size_t buflen);

/* Get IP and status for a user. Returns 0 on success, -1 if not found. */
int cl_get_info(const char *username, char *buf, size_t buflen);

/* Update last activity timestamp. Returns 1 if client was reactivated from
   INACTIVE to ACTIVE, 0 otherwise. */
int cl_touch(int sockfd);

#endif

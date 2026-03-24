#include "client_list.h"
#include <string.h>
#include <stdio.h>

Cliente         lista[MAX_CLIENTS];
int             num_clientes = 0;
pthread_mutex_t mutex_lista  = PTHREAD_MUTEX_INITIALIZER;

void cl_init(void) {
    pthread_mutex_lock(&mutex_lista);
    memset(lista, 0, sizeof(lista));
    num_clientes = 0;
    pthread_mutex_unlock(&mutex_lista);
}

int cl_find_by_name(const char *username) {
    for (int i = 0; i < num_clientes; i++) {
        if (lista[i].activo && strcmp(lista[i].username, username) == 0)
            return i;
    }
    return -1;
}

int cl_find_by_fd(int sockfd) {
    for (int i = 0; i < num_clientes; i++) {
        if (lista[i].activo && lista[i].sockfd == sockfd)
            return i;
    }
    return -1;
}

int cl_add(const char *username, const char *ip, int sockfd) {
    int ret = 0;
    pthread_mutex_lock(&mutex_lista);

    if (num_clientes >= MAX_CLIENTS) {
        ret = -2;
        goto done;
    }

    /* Check duplicate username or IP */
    for (int i = 0; i < num_clientes; i++) {
        if (!lista[i].activo) continue;
        if (strcmp(lista[i].username, username) == 0 ||
            strcmp(lista[i].ip, ip) == 0) {
            ret = -1;
            goto done;
        }
    }

    /* Find empty slot or append */
    int slot = -1;
    for (int i = 0; i < num_clientes; i++) {
        if (!lista[i].activo) { slot = i; break; }
    }
    if (slot < 0) slot = num_clientes++;

    memset(&lista[slot], 0, sizeof(Cliente));
    strncpy(lista[slot].username, username, 31);
    strncpy(lista[slot].ip, ip, INET_ADDRSTRLEN - 1);
    strncpy(lista[slot].status, "ACTIVE", 15);
    lista[slot].sockfd = sockfd;
    lista[slot].activo = 1;
    lista[slot].ultimo_mensaje = time(NULL);

done:
    pthread_mutex_unlock(&mutex_lista);
    return ret;
}

int cl_remove(int sockfd) {
    int ret = -1;
    pthread_mutex_lock(&mutex_lista);
    int idx = cl_find_by_fd(sockfd);
    if (idx >= 0) {
        lista[idx].activo = 0;
        ret = 0;
    }
    pthread_mutex_unlock(&mutex_lista);
    return ret;
}

int cl_set_status(const char *username, const char *new_status) {
    int ret = -1;
    pthread_mutex_lock(&mutex_lista);
    int idx = cl_find_by_name(username);
    if (idx >= 0) {
        strncpy(lista[idx].status, new_status, 15);
        lista[idx].status[15] = '\0';
        ret = 0;
    }
    pthread_mutex_unlock(&mutex_lista);
    return ret;
}

void cl_build_list(char *buf, size_t buflen) {
    pthread_mutex_lock(&mutex_lista);
    buf[0] = '\0';
    size_t offset = 0;
    for (int i = 0; i < num_clientes; i++) {
        if (!lista[i].activo) continue;
        int n = snprintf(buf + offset, buflen - offset, "%s%s,%s",
                         (offset > 0) ? ";" : "",
                         lista[i].username, lista[i].status);
        if (n < 0 || (size_t)n >= buflen - offset) break;
        offset += (size_t)n;
    }
    pthread_mutex_unlock(&mutex_lista);
}

int cl_get_info(const char *username, char *buf, size_t buflen) {
    int ret = -1;
    pthread_mutex_lock(&mutex_lista);
    int idx = cl_find_by_name(username);
    if (idx >= 0) {
        snprintf(buf, buflen, "%s,%s", lista[idx].ip, lista[idx].status);
        ret = 0;
    }
    pthread_mutex_unlock(&mutex_lista);
    return ret;
}

int cl_touch(int sockfd) {
    int reactivated = 0;
    pthread_mutex_lock(&mutex_lista);
    int idx = cl_find_by_fd(sockfd);
    if (idx >= 0) {
        lista[idx].ultimo_mensaje = time(NULL);
        if (strcmp(lista[idx].status, "INACTIVE") == 0) {
            strncpy(lista[idx].status, "ACTIVE", 15);
            reactivated = 1;
        }
    }
    pthread_mutex_unlock(&mutex_lista);
    return reactivated;
}

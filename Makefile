CC      = gcc
CFLAGS  = -Wall -Wextra -pthread -Isrc
LDFLAGS = -pthread

SRV_SRC = src/server/servidor.c src/server/client_list.c src/server/server_handlers.c
CLI_SRC = src/client/cliente.c src/client/client_net.c src/client/client_ui.c

SRV_OBJ = $(SRV_SRC:.c=.o)
CLI_OBJ = $(CLI_SRC:.c=.o)

all: servidor cliente

servidor: $(SRV_OBJ)
	$(CC) $(LDFLAGS) -o $@ $^

cliente: $(CLI_OBJ)
	$(CC) $(LDFLAGS) -o $@ $^

src/%.o: src/%.c
	$(CC) $(CFLAGS) -c -o $@ $<

clean:
	rm -f servidor cliente $(SRV_OBJ) $(CLI_OBJ)

.PHONY: all clean

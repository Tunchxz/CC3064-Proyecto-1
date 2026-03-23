# Chat en C — Proyecto 1

Sistema de chat cliente-servidor desarrollado en C utilizando sockets TCP, multithreading con pthreads y un protocolo binario de paquetes fijos de 1024 bytes.

## Descripción

La aplicación permite que múltiples clientes se conecten a un servidor central para intercambiar mensajes en tiempo real. El servidor gestiona las conexiones de forma concurrente mediante threads, manteniendo una lista de usuarios conectados con su estado y dirección IP. Los clientes pueden enviar mensajes a todos (broadcasting), mensajes directos privados, cambiar su estado, consultar usuarios conectados y obtener información de usuarios específicos.

El protocolo de comunicación utiliza un `struct` binario (`ChatPacket`) de exactamente 1024 bytes, compatible con la especificación acordada entre todos los grupos del curso.

## Estructura del Proyecto

```
CC3064-Proyecto-1/
├── Makefile                          # Compilación del proyecto
├── src/
│   ├── protocolo.h                   # Definición del protocolo (struct de 1024 bytes)
│   ├── server/
│   │   ├── servidor.c                # Main del servidor: accept loop, threads, monitor de inactividad
│   │   ├── client_list.h             # Interfaz del módulo de lista de clientes
│   │   ├── client_list.c             # Lista de clientes thread-safe con mutex
│   │   ├── server_handlers.h         # Interfaz de los handlers de comandos
│   │   └── server_handlers.c         # Lógica para cada comando del protocolo
│   └── client/
│       ├── cliente.c                 # Main del cliente: conexión, thread receptor, input loop
│       ├── client_net.h              # Interfaz del módulo de red
│       ├── client_net.c              # Conexión TCP y constructores de paquetes
│       ├── client_ui.h               # Interfaz del módulo de UI
│       └── client_ui.c               # Parsing de comandos y visualización de mensajes
```

### Módulos

| Módulo                    | Archivos              | Responsabilidad                                                       |
| ------------------------- | --------------------- | --------------------------------------------------------------------- |
| **Protocolo**             | `protocolo.h`         | Define `ChatPacket`, códigos de comando, estados y timeout            |
| **Lista de clientes**     | `client_list.h/c`     | CRUD de usuarios conectados, protegido con `pthread_mutex_t`          |
| **Handlers del servidor** | `server_handlers.h/c` | Procesa cada tipo de comando recibido de los clientes                 |
| **Servidor**              | `servidor.c`          | Accept loop, crea un thread por cliente, monitor de inactividad       |
| **Red del cliente**       | `client_net.h/c`      | Conexión TCP y funciones para construir y enviar cada tipo de paquete |
| **UI del cliente**        | `client_ui.h/c`       | Interpreta comandos del usuario y formatea mensajes entrantes         |
| **Cliente**               | `cliente.c`           | Registro, thread receptor de mensajes, loop de entrada del usuario    |

## Cómo Ejecutar

### Requisitos

- GCC con soporte para pthreads
- Sistema operativo Linux (o WSL)
- `make`

### Compilación

```bash
make
```

Esto genera dos binarios en la raíz del proyecto: `servidor` y `cliente`.

Para limpiar los binarios y archivos objeto:

```bash
make clean
```

### Iniciar el servidor

```bash
./servidor <puerto>
```

Ejemplo:

```bash
./servidor 8080
```

### Conectar un cliente

```bash
./cliente <usuario> <IP_servidor> <puerto>
```

Ejemplo local:

```bash
./cliente alice 127.0.0.1 8080
```

Ejemplo remoto (EC2):

```bash
./cliente alice 54.123.45.67 8080
```

## Cómo Usar

Una vez conectado, el cliente acepta los siguientes comandos:

| Comando                            | Descripción                                         |
| ---------------------------------- | --------------------------------------------------- |
| `/broadcast <mensaje>`             | Envía un mensaje a todos los usuarios conectados    |
| `/msg <usuario> <mensaje>`         | Envía un mensaje directo privado a un usuario       |
| `/status <ACTIVE\|BUSY\|INACTIVE>` | Cambia tu estado                                    |
| `/list`                            | Muestra la lista de usuarios conectados y su estado |
| `/info <usuario>`                  | Muestra la IP y estado de un usuario específico     |
| `/help`                            | Muestra la ayuda con todos los comandos             |
| `/exit`                            | Cierra la sesión y sale del chat                    |

### Ejemplo de sesión

```
$ ./cliente alice 127.0.0.1 8080
[OK] Bienvenido alice
Conectado como 'alice'. Escribe /help para ver comandos.

> /broadcast Hola a todos!
[alice] Hola a todos!
> /msg bob Hey, ¿cómo estás?
> [DM de bob] Bien, gracias!
> /status BUSY
[OK] BUSY
> /list

--- Usuarios conectados ---
  alice                [BUSY]
  bob                  [ACTIVE]
----------------------------

> /info bob

--- Info de usuario ---
  IP:     192.168.1.10
  Status: ACTIVE
-----------------------

> /exit
¡Hasta luego!
```

## Principales Features

- **Multithreading en el servidor**: cada cliente es atendido por un thread dedicado, permitiendo concurrencia real en el manejo de conexiones y mensajes.
- **Protocolo binario de 1024 bytes**: paquetes de tamaño fijo que simplifican la lectura/escritura en red y garantizan compatibilidad entre grupos.
- **Thread-safety**: la lista de clientes está protegida con `pthread_mutex_t` para evitar condiciones de carrera.
- **Detección de inactividad**: un thread monitor revisa periódicamente la actividad de cada cliente y cambia automáticamente su estado a `INACTIVE` tras 60 segundos sin actividad.
- **Desconexión controlada y abrupta**: el servidor maneja tanto el logout voluntario (`/exit`) como la caída inesperada del cliente (detección por `recv()` retornando 0 o -1), notificando a los demás usuarios en ambos casos.
- **Broadcasting y mensajes directos**: soporte completo para chat general y mensajes privados entre usuarios.
- **Interfaz con colores**: los mensajes se muestran con colores ANSI para diferenciar mensajes del servidor, broadcasts, mensajes directos y errores.

## Basic Troubleshooting

### "bind: Address already in use"

El puerto está ocupado por otra instancia del servidor o un proceso previo que no liberó el socket. Espera unos segundos o usa otro puerto:

```bash
./servidor 8081
```

### "connect: Connection refused"

- Verifica que el servidor esté corriendo en la IP y puerto indicados.
- Si usas EC2, asegúrate de que el Security Group tenga una regla Custom TCP con el puerto abierto y origen `0.0.0.0/0`.

### "Usuario ya existe"

Otro cliente ya está registrado con ese nombre o desde esa IP. Usa un nombre de usuario diferente.

### El cliente se congela o no muestra mensajes

- Verifica que la conexión de red entre cliente y servidor esté activa.
- Si el servidor se cayó, el cliente mostrará `[!] Conexión con el servidor perdida.`

### El estado cambia a INACTIVE automáticamente

Esto es normal. El servidor marca como `INACTIVE` a cualquier cliente que no envíe comandos durante 60 segundos. Envía cualquier comando o cambia tu estado con `/status ACTIVE` para reactivarte.

### No compila

Asegúrate de tener `gcc` y `make` instalados:

```bash
sudo apt update && sudo apt install build-essential
```

# Chat en C — Proyecto 1

Sistema de chat cliente-servidor desarrollado en C utilizando sockets TCP, multithreading con pthreads y un protocolo binario de paquetes fijos de 1024 bytes. Proyecto del curso de Sistemas Operativos (CC3064) de la Universidad del Valle de Guatemala.

## Descripción

La aplicación permite que múltiples clientes se conecten a un servidor central para intercambiar mensajes en tiempo real. El servidor gestiona las conexiones de forma concurrente mediante threads, manteniendo una lista de usuarios conectados con su estado y dirección IP.

El protocolo de comunicación utiliza un `struct` binario (`ChatPacket`) de exactamente 1024 bytes, compatible con la especificación acordada entre todos los grupos del curso.

## Arquitectura

El proyecto tiene dos capas independientes que comparten únicamente el protocolo binario:

```
┌──────────────────┐     ┌───────────────┐     ┌──────────────────┐
│ Cliente terminal │────►│               │◄────│ Browser (React)  │
│ ./cliente        │ TCP │  ./servidor   │ TCP │   ↕ WebSocket    │
│                  │     │   (puerto C)  │     │ Bridge (Node.js) │
└──────────────────┘     └───────────────┘     └──────────────────┘
```

El servidor C es agnóstico al tipo de cliente. El bridge Node.js traduce WebSocket ↔ TCP binario, abriendo una conexión independiente por cada usuario del browser.

## Estructura del Proyecto

```
CC3064-Proyecto-1/
├── Makefile
├── docker-compose.yml
├── docker/
│   └── servidor.Dockerfile
├── src/
│   ├── protocolo.h                   # Struct ChatPacket (1024 bytes)
│   ├── server/
│   │   ├── servidor.c                # Accept loop, threads, monitor de inactividad
│   │   ├── client_list.h / .c        # Lista de clientes thread-safe (mutex)
│   │   └── server_handlers.h / .c    # Handler por cada comando del protocolo
│   └── client/
│       ├── cliente.c                 # Conexión, thread receptor, input loop
│       ├── client_net.h / .c         # Conexión TCP y constructores de paquetes
│       └── client_ui.h / .c          # Parsing de comandos y display de mensajes
└── chat-frontend/                    # Frontend web (ver chat-frontend/README.md)
    ├── bridge/                       # Bridge WebSocket ↔ TCP (Node.js)
    └── frontend/                     # React app
```

## Quick Start

### Requisitos

- GCC con soporte para pthreads
- Linux o WSL
- `make`

### Compilar y ejecutar

```bash
make                              # genera ./servidor y ./cliente

./servidor 8080                   # iniciar servidor
./cliente alice 127.0.0.1 8080    # conectar un cliente
```

### Cliente de terminal — Comandos

| Comando                            | Descripción                                         |
| ---------------------------------- | --------------------------------------------------- |
| `/broadcast <mensaje>`             | Envía un mensaje a todos los usuarios conectados    |
| `/msg <usuario> <mensaje>`         | Envía un mensaje directo privado a un usuario       |
| `/status <ACTIVE\|BUSY\|INACTIVE>` | Cambia tu estado                                    |
| `/list`                            | Muestra la lista de usuarios conectados y su estado |
| `/info <usuario>`                  | Muestra la IP y estado de un usuario específico     |
| `/help`                            | Muestra la ayuda con todos los comandos             |
| `/exit`                            | Cierra la sesión y sale del chat                    |

### Frontend web

El proyecto incluye una interfaz web en React con un bridge Node.js. Consulta [chat-frontend/README.md](chat-frontend/README.md) para instalación y uso detallado.

## Despliegue con Docker

Un solo comando levanta servidor C + bridge + frontend:

```bash
docker compose up --build -d
```

| Servicio   | Puerto | Descripción                 |
| ---------- | ------ | --------------------------- |
| `servidor` | `8080` | Servidor C (TCP)            |
| `bridge`   | `4000` | Bridge WebSocket ↔ TCP      |
| `frontend` | `3000` | React app servida con nginx |

Acceder: `http://localhost:3000` (o `http://<IP-PUBLICA>:3000` desde otra máquina).

Detener: `docker compose down`

### Despliegue en EC2 con Docker

1. Instalar Docker en la instancia EC2:
   ```bash
   sudo apt update && sudo apt install -y docker.io docker-compose-v2
   sudo usermod -aG docker $USER
   ```

2. Clonar el repo y levantar:
   ```bash
   git clone https://github.com/<tu-usuario>/<tu-repo>.git
   cd CC3064-Proyecto-1
   docker compose up --build -d
   ```

3. Abrir puertos en el **Security Group**: `3000`, `4000` y `8080` (Custom TCP, origen `0.0.0.0/0`)

4. Acceder desde cualquier browser: `http://<IP-PUBLICA-EC2>:3000`

## Principales Features

- **Multithreading en el servidor**: un thread dedicado por cliente para concurrencia real.
- **Protocolo binario de 1024 bytes**: paquetes de tamaño fijo compatibles entre grupos.
- **Thread-safety**: lista de clientes protegida con `pthread_mutex_t`.
- **Detección de inactividad**: thread monitor cambia estado a `INACTIVE` tras 60 segundos sin actividad; se reactiva automáticamente al enviar cualquier comando.
- **Desconexión controlada y abrupta**: maneja logout voluntario y caída inesperada, notificando a los demás.
- **Broadcasting y mensajes directos**: chat general y mensajes privados.
- **Frontend web**: interfaz React con dark theme, lista de usuarios en tiempo real y mensajes directos.
- **Docker Compose**: despliegue de toda la aplicación con un solo comando.

## Troubleshooting

| Problema                         | Solución                                                                   |
| -------------------------------- | -------------------------------------------------------------------------- |
| `bind: Address already in use`   | Espera unos segundos o usa otro puerto (`./servidor 8081`)                 |
| `connect: Connection refused`    | Verifica que el servidor esté corriendo. En EC2, revisa el Security Group. |
| `Usuario ya existe`              | Usa un nombre de usuario diferente                                         |
| El estado cambia a INACTIVE solo | Normal: 60s sin actividad. Envía cualquier comando para reactivarte.       |
| No compila                       | `sudo apt install build-essential`                                         |

Para problemas del frontend web, consulta [chat-frontend/README.md](chat-frontend/README.md#solución-de-problemas).

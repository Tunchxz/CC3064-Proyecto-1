# Chat UVG — Frontend Web

Interfaz web tipo WhatsApp para el proyecto de chat en C. Se comunica con el servidor C a través de un bridge Node.js que traduce WebSocket ↔ TCP binario. No modifica el servidor ni el cliente C.

## Flujo de conexión

```
Browser (React, :3000)
    ↕  WebSocket
Bridge Node.js (:4000)
    ↕  TCP binario (ChatPacket 1024 bytes)
Servidor C (:8080)
```

El bridge abre una conexión TCP independiente por cada usuario del browser. El servidor C los ve como clientes normales.

## Estructura

```
chat-frontend/
├── bridge/
│   ├── bridge.js         # Puente WebSocket ↔ TCP binario
│   └── package.json
└── frontend/
    ├── public/index.html
    └── src/
        ├── App.js            # Componentes: LoginScreen, ChatScreen, modales
        ├── App.module.css    # Estilos con CSS Modules
        ├── index.css         # Variables de tema globales
        ├── index.js          # Entry point de React
        └── useChat.js        # Hook de estado y comunicación WebSocket
```

## Instalación

### Requisitos

- Node.js v18+ ([descargar LTS](https://nodejs.org))
- Servidor C corriendo (`./servidor 8080`)

Verificar instalación:
```bash
node --version    # v18.x o superior
npm --version
```

### Instalar dependencias

```bash
cd chat-frontend/bridge && npm install
cd chat-frontend/frontend && npm install
```

## Cómo ejecutar

Se necesitan **3 terminales** (o usar Docker Compose desde la raíz del proyecto):

**Terminal 1 — Servidor C:**
```bash
./servidor 8080
```

**Terminal 2 — Bridge:**
```bash
cd chat-frontend/bridge
node bridge.js
# ✅ Bridge corriendo en ws://localhost:4000
```

**Terminal 3 — Frontend:**
```bash
cd chat-frontend/frontend
npm start
# Abre http://localhost:3000 automáticamente
```

### Conectarse

1. Escribe tu nombre de usuario
2. Ingresa IP y puerto del servidor (`127.0.0.1` / `8080` para local)
3. Clic en **Conectar**
4. Puedes abrir múltiples pestañas con diferentes usuarios

## Configuración del bridge

El bridge toma la IP/puerto del servidor desde el frontend por defecto. Para forzar una conexión fija (útil en Docker o WSL), usa variables de entorno:

```bash
# Linux / macOS
CHAT_HOST=192.168.1.50 CHAT_PORT=9090 node bridge.js

# Windows (CMD)
set CHAT_HOST=192.168.1.50 && set CHAT_PORT=9090 && node bridge.js
```

## Acciones en la UI

| Acción                 | Cómo hacerlo                                        |
| ---------------------- | --------------------------------------------------- |
| Mensaje a todos        | Escribe en el canal **# General**                   |
| Mensaje directo        | Clic en un usuario del sidebar, escribe ahí         |
| Cambiar estado         | Clic en tu estado (● Activo ▾) en el sidebar        |
| Ver lista de usuarios  | Sidebar (se actualiza automáticamente, o botón ↻)   |
| Ver info de un usuario | Botón ⓘ junto al usuario, o "Ver info" en el header |
| Salir                  | Botón ⏻ arriba a la izquierda                       |

## Despliegue manual en EC2

Si no usas Docker, puedes correr los 3 procesos manualmente con `tmux`:

Puertos a abrir en el **Security Group**:

| Puerto | Para qué         |
| ------ | ---------------- |
| `8080` | Servidor C       |
| `4000` | Bridge WebSocket |
| `3000` | Frontend React   |

```bash
# Ventana 1 — servidor C
tmux new -s servidor
./servidor 8080
# Ctrl+B, D para desconectar

# Ventana 2 — bridge
tmux new -s bridge
cd chat-frontend/bridge && node bridge.js
# Ctrl+B, D

# Ventana 3 — frontend
tmux new -s frontend
cd chat-frontend/frontend && npm start
# Ctrl+B, D
```

Acceder desde el browser: `http://<IP-PUBLICA-EC2>:3000`

> Para producción se recomienda `npm run build` y servir `build/` con nginx en el puerto 80.

## Solución de problemas

### "No se pudo conectar al bridge"
- Verifica que `node bridge.js` esté corriendo en la terminal 2.
- Verifica que el puerto 4000 no esté ocupado.

### "No compila el frontend"
Asegúrate de haber corrido `npm install` dentro de `chat-frontend/frontend`.

### WSL: el bridge no puede conectarse al servidor C
Si el servidor corre en WSL y el bridge en Windows, necesitas la IP de WSL:

```bash
# En WSL:
hostname -I
# Usa esa IP:
set CHAT_HOST=<ip-de-wsl> && node bridge.js
```

### Puerto 3000 o 4000 ya en uso
```bash
# Cambiar puerto del frontend:
PORT=3001 npm start

# Cambiar puerto del bridge (variable de entorno):
BRIDGE_PORT=4001 node bridge.js
```

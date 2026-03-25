# Chat UVG — Frontend Web

Interfaz web tipo WhatsApp para el proyecto de chat en C.
No toca nada del servidor ni del cliente C original.

## Estructura

```
chat-frontend/
├── bridge/
│   ├── bridge.js       ← Puente WebSocket ↔ TCP binario (Node.js)
│   └── package.json
└── frontend/
    ├── public/
    │   └── index.html
    └── src/
        ├── index.js
        ├── index.css
        ├── App.js
        ├── App.module.css
        └── useChat.js
```

## Flujo de conexión

```
Tu navegador (React)
      ↕  WebSocket :4000
   bridge.js (Node.js)
      ↕  TCP binario :8080
   servidor C (WSL/Linux)
```

---

## INSTALACIÓN PASO A PASO

### 1. Instalar Node.js

Descarga desde https://nodejs.org la versión **LTS** (la que dice "Recommended").
Instálalo normalmente. Para verificar que quedó instalado:

```bash
node --version    # debe mostrar v18.x o superior
npm --version
```

### 2. Copiar la carpeta `chat-frontend`

Pon la carpeta `chat-frontend` en cualquier lugar de tu máquina.
Por ejemplo: `C:\Users\TuNombre\chat-frontend` en Windows.

### 3. Instalar dependencias del bridge

Abre una terminal (CMD, PowerShell o la terminal de VS Code):

```bash
cd chat-frontend/bridge
npm install
```

### 4. Instalar dependencias del frontend

Abre **otra** terminal:

```bash
cd chat-frontend/frontend
npm install
```

---

## CÓMO USARLO

### Paso A — Inicia el servidor C (en WSL/Linux)

En tu terminal de WSL, en la carpeta del proyecto original:

```bash
./servidor 8080
```

### Paso B — Inicia el bridge

En una terminal en tu máquina Windows (o Linux):

```bash
cd chat-frontend/bridge
node bridge.js
```

Deberías ver:
```
✅ Bridge corriendo en ws://localhost:4000
   Conectando al servidor C en 127.0.0.1:8080
```

> **Nota**: Si tu servidor C corre en otra IP o puerto, cámbialo así:
> ```bash
> CHAT_HOST=192.168.1.50 CHAT_PORT=9090 node bridge.js
> ```
> En Windows (CMD):
> ```cmd
> set CHAT_HOST=127.0.0.1 && set CHAT_PORT=8080 && node bridge.js
> ```

### Paso C — Inicia el frontend React

En otra terminal:

```bash
cd chat-frontend/frontend
npm start
```

Esto abre automáticamente `http://localhost:3000` en tu navegador.

### Paso D — Conéctate

1. Escribe tu nombre de usuario
2. Haz clic en **Conectar**
3. ¡Listo! Puedes abrir múltiples pestañas con diferentes usuarios

---

## COMANDOS DISPONIBLES EN LA UI

| Acción                        | Cómo hacerlo                                           |
|-------------------------------|--------------------------------------------------------|
| Mensaje a todos               | Escribe en el canal **# General**                      |
| Mensaje directo               | Haz clic en un usuario en el sidebar → escribe ahí     |
| Cambiar estado                | Clic en tu estado (●Activo) en el sidebar              |
| Ver lista de usuarios         | Sidebar (se actualiza con el botón ↻)                  |
| Ver info (IP) de un usuario   | Botón ⓘ al lado del usuario, o "Ver info" en el header |
| Salir                         | Botón ⏻ en la esquina superior izquierda               |

---

## SOLUCIÓN DE PROBLEMAS

### "No se pudo conectar al bridge"
- Verifica que `node bridge.js` esté corriendo
- Verifica que el servidor C esté corriendo en el mismo puerto

### "No compila el frontend"
Asegúrate de haber corrido `npm install` dentro de `chat-frontend/frontend`.

### WSL: el bridge no puede conectarse al servidor C
Si el servidor corre en WSL y el bridge en Windows, usa la IP de WSL:

```bash
# En WSL, corre esto para ver tu IP:
hostname -I
# Usa esa IP en el bridge:
set CHAT_HOST=<ip-de-wsl> && node bridge.js
```

### Puerto 3000 o 4000 ya en uso
```bash
# Cambiar puerto del bridge (en bridge.js, línea: const BRIDGE_PORT = 4000)
# Cambiar puerto del frontend:
PORT=3001 npm start
```

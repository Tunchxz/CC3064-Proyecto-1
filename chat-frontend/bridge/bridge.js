/**
 * bridge.js — Puente WebSocket ↔ TCP binario (ChatPacket 1024 bytes)
 * La IP y puerto del servidor C se reciben dinámicamente desde el frontend
 * en el primer mensaje de cada conexión WebSocket.
 */

const net = require("net");
const http = require("http");
const WebSocket = require("ws");
const WebSocketServer = WebSocket.Server;

const WS_OPEN = 1;
const BRIDGE_PORT = 4000;

const CMD = {
  REGISTER: 1, BROADCAST: 2, DIRECT: 3, LIST: 4,
  INFO: 5, STATUS: 6, LOGOUT: 7, OK: 8, ERROR: 9,
  MSG: 10, USER_LIST: 11, USER_INFO: 12, DISCONNECTED: 13,
};

function buildPacket(command, sender, target, payload) {
  const buf = Buffer.alloc(1024, 0);
  buf.writeUInt8(command, 0);
  const payloadBuf = Buffer.from(payload || "", "utf8").slice(0, 957);
  buf.writeUInt16LE(payloadBuf.length, 1);
  Buffer.from(sender || "", "utf8").copy(buf, 3, 0, 32);
  Buffer.from(target || "", "utf8").copy(buf, 35, 0, 32);
  payloadBuf.copy(buf, 67);
  return buf;
}

function parsePacket(buf) {
  if (buf.length < 1024) return null;
  const payloadLen = buf.readUInt16LE(1);
  return {
    command:     buf.readUInt8(0),
    payload_len: payloadLen,
    sender:      buf.slice(3, 35).toString("utf8").replace(/\0/g, "").trim(),
    target:      buf.slice(35, 67).toString("utf8").replace(/\0/g, "").trim(),
    payload:     buf.slice(67, 67 + payloadLen).toString("utf8").replace(/\0/g, ""),
  };
}

function sendWs(ws, obj) {
  if (ws.readyState === WS_OPEN) ws.send(JSON.stringify(obj));
}

const httpServer = http.createServer();
const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws) => {
  console.log("[Bridge] Nueva conexión WebSocket");

  const tcp = new net.Socket();
  let tcpBuffer = Buffer.alloc(0);
  let tcpConnected = false;

  // Primer mensaje: { type:"connect", host:"1.2.3.4", port:"8080" }
  ws.once("message", (raw) => {
    let init;
    try { init = JSON.parse(raw); } catch {
      sendWs(ws, { command: CMD.ERROR, sender: "BRIDGE", target: "", payload: "Mensaje de inicio invalido." });
      return ws.close();
    }

    if (init.type !== "connect" || !init.host || !init.port) {
      sendWs(ws, { command: CMD.ERROR, sender: "BRIDGE", target: "", payload: "Se requiere {type:'connect', host, port}." });
      return ws.close();
    }

    const host = init.host.trim();
    const port = parseInt(init.port);
    console.log(`[Bridge] Conectando TCP → ${host}:${port}`);

    tcp.connect(port, host, () => {
      tcpConnected = true;
      console.log(`[Bridge] TCP conectado a ${host}:${port}`);
      // Señal interna al frontend: TCP listo
      sendWs(ws, { command: 0, sender: "BRIDGE", target: "", payload: "tcp_ok" });
    });

    tcp.on("error", (err) => {
      console.error("[Bridge] Error TCP:", err.message);
      sendWs(ws, { command: CMD.ERROR, sender: "BRIDGE", target: "", payload: `No se pudo conectar a ${host}:${port} — ${err.message}` });
      ws.close();
    });

    tcp.on("close", () => {
      console.log("[Bridge] TCP cerrado");
      if (ws.readyState === WS_OPEN) ws.close();
    });

    tcp.on("data", (data) => {
      tcpBuffer = Buffer.concat([tcpBuffer, data]);
      while (tcpBuffer.length >= 1024) {
        const pkt = parsePacket(tcpBuffer.slice(0, 1024));
        tcpBuffer = tcpBuffer.slice(1024);
        if (pkt) sendWs(ws, pkt);
      }
    });

    // Mensajes siguientes: paquetes del chat
    ws.on("message", (raw2) => {
      if (!tcpConnected) return;
      try {
        const msg = JSON.parse(raw2);
        const pkt = buildPacket(msg.command, msg.sender, msg.target || "", msg.payload || "");
        tcp.write(pkt);
      } catch (e) {
        console.error("[Bridge] Mensaje invalido:", e.message);
      }
    });
  });

  ws.on("close", () => {
    console.log("[Bridge] WebSocket cerrado");
    if (!tcp.destroyed) tcp.destroy();
  });
});

httpServer.listen(BRIDGE_PORT, () => {
  console.log(`✅ Bridge corriendo en ws://localhost:${BRIDGE_PORT}`);
  console.log(`   Esperando conexiones del frontend...`);
});

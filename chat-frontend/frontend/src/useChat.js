import { useState, useRef, useCallback, useEffect } from 'react';

const CMD = {
  REGISTER: 1, BROADCAST: 2, DIRECT: 3, LIST: 4,
  INFO: 5, STATUS: 6, LOGOUT: 7, OK: 8, ERROR: 9,
  MSG: 10, USER_LIST: 11, USER_INFO: 12, DISCONNECTED: 13,
};

/* Derive bridge URL from the page's hostname so it works on any deployment
   (localhost for dev, public IP for EC2/Docker). Override with env var at build time. */
const BRIDGE_URL = process.env.REACT_APP_BRIDGE_URL
  || `ws://${window.location.hostname}:4000`;
const POLL_INTERVAL_MS = 15_000;

export function useChat() {
  const [phase, setPhase] = useState('login');
  const [username, setUsername] = useState('');
  const [myStatus, setMyStatus] = useState('ACTIVE');
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeChat, setActiveChat] = useState('ALL');
  const [userInfo, setUserInfo] = useState(null);
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [loginError, setLoginError] = useState('');

  const ws = useRef(null);
  const pendingUser = useRef('');
  const usernameRef = useRef('');
  const voluntaryLogout = useRef(false);
  const pollTimer = useRef(null);

  // ── CLAVE: ref para que onmessage siempre llame a la versión más reciente ─
  const handlePacketRef = useRef(null);

  const addMessage = useCallback((msg) => {
    setMessages(prev => [...prev, { ...msg, id: Date.now() + Math.random(), ts: new Date() }]);
  }, []);

  const send = useCallback((obj) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(obj));
    }
  }, []);

  // ── Polling ───────────────────────────────────────────────────────────────

  const startPolling = useCallback(() => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(() => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN && usernameRef.current) {
        ws.current.send(JSON.stringify({
          command: CMD.LIST, sender: usernameRef.current, target: '', payload: '',
        }));
      }
    }, POLL_INTERVAL_MS);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
  }, []);

  // ── Handler de paquetes ───────────────────────────────────────────────────
  // NO está en useCallback — se redefine en cada render y se guarda en el ref
  // para que onmessage siempre use la versión actualizada con el estado actual.

  const handlePacket = (pkt) => {
    const user = pendingUser.current;

    // Señal interna bridge → TCP listo → registrar
    if (pkt.command === 0 && pkt.payload === 'tcp_ok') {
      ws.current.send(JSON.stringify({
        command: CMD.REGISTER, sender: user, target: '', payload: user,
      }));
      return;
    }

    switch (pkt.command) {

      case CMD.OK:
        if (pkt.payload.startsWith('Bienvenido')) {
          usernameRef.current = user;
          setUsername(user);
          setPhase('chat');
          setMyStatus('ACTIVE');
          setMessages([]);
          setTimeout(() => {
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
              ws.current.send(JSON.stringify({
                command: CMD.LIST, sender: user, target: '', payload: '',
              }));
            }
          }, 200);
          startPolling();
        } else if (['ACTIVE', 'BUSY', 'INACTIVE'].includes(pkt.payload)) {
          setMyStatus(pkt.payload);
          addMessage({ type: 'system', sender: 'SISTEMA', text: `Estado cambiado a ${pkt.payload}` });
        }
        break;

      case CMD.ERROR:
        if (!usernameRef.current) {
          setLoginError(pkt.payload);
          setWsStatus('disconnected');
          ws.current?.close();
        } else {
          addMessage({ type: 'error', sender: 'ERROR', text: pkt.payload });
        }
        break;

      case CMD.MSG: {
        const me = usernameRef.current;

        // Mensajes del servidor sobre cambio de status automático
        // servidor.c envía: CMD_MSG, sender="SERVER", target=username, payload="Tu status cambió a INACTIVE"
        // servidor.c envía: CMD_MSG, sender="SERVER", payload="Tu status volvió a ACTIVE"
        if (pkt.sender === 'SERVER') {
          const p = pkt.payload;

          if (p.includes('INACTIVE')) {
            setMyStatus('INACTIVE');
            addMessage({ type: 'system', sender: 'SISTEMA', text: 'Tu estado cambió a Inactivo por inactividad.' });
            break;
          }

          if (p.includes('ACTIVE')) {
            setMyStatus('ACTIVE');
            addMessage({ type: 'system', sender: 'SISTEMA', text: 'Tu estado volvió a Activo.' });
            break;
          }

          addMessage({ type: 'system', sender: 'SISTEMA', text: p });
          break;
        }

        // Ignorar eco de mis propios mensajes
        if (pkt.sender === me) break;

        addMessage({
          type: pkt.target === 'ALL' ? 'broadcast' : 'direct',
          sender: pkt.sender,
          target: pkt.target,
          text: pkt.payload,
        });
        break;
      }

      case CMD.USER_LIST: {
        const parsed = pkt.payload.split(';').filter(Boolean).map(entry => {
          const [name, status] = entry.split(',');
          return { name, status: status || 'ACTIVE' };
        });
        setUsers(parsed);

        // Respaldo: detectar cambio de status desde la lista
        const me = usernameRef.current;
        if (me) {
          const myEntry = parsed.find(u => u.name === me);
          if (myEntry) {
            setMyStatus(prev => {
              if (prev !== myEntry.status) {
                if (myEntry.status === 'INACTIVE') {
                  addMessage({ type: 'system', sender: 'SISTEMA', text: 'Tu estado cambió a Inactivo por inactividad.' });
                } else if (myEntry.status === 'ACTIVE' && prev === 'INACTIVE') {
                  addMessage({ type: 'system', sender: 'SISTEMA', text: 'Tu estado volvió a Activo.' });
                }
              }
              return myEntry.status;
            });
          }
        }
        break;
      }

      case CMD.USER_INFO:
        setUserInfo({ raw: pkt.payload, target: pkt.target });
        break;

      case CMD.DISCONNECTED:
        addMessage({ type: 'system', sender: 'SISTEMA', text: `${pkt.payload} se desconectó.` });
        setUsers(prev => prev.filter(u => u.name !== pkt.payload));
        break;

      default:
        break;
    }
  };

  // Actualizar el ref en cada render para que onmessage siempre tenga acceso
  // al handler con el estado más reciente (evita stale closure)
  handlePacketRef.current = handlePacket;

  // ── Conexión ──────────────────────────────────────────────────────────────

  const connect = useCallback((user, host, port) => {
    if (ws.current) ws.current.close();
    pendingUser.current = user;
    usernameRef.current = '';
    voluntaryLogout.current = false;
    setLoginError('');
    setWsStatus('connecting');

    const socket = new WebSocket(BRIDGE_URL);
    ws.current = socket;

    socket.onopen = () => {
      setWsStatus('connected');
      socket.send(JSON.stringify({ type: 'connect', host, port }));
    };

    // onmessage llama SIEMPRE al ref → nunca queda atrapado en un closure viejo
    socket.onmessage = (e) => {
      try { handlePacketRef.current(JSON.parse(e.data)); } catch(err) {
        console.error('[useChat] Error procesando paquete:', err);
      }
    };

    socket.onerror = () => {
      setWsStatus('disconnected');
      setLoginError('No se pudo conectar al bridge. ¿Está corriendo bridge.js?');
    };

    socket.onclose = () => {
      setWsStatus('disconnected');
      stopPolling();
      if (usernameRef.current && !voluntaryLogout.current) {
        usernameRef.current = '';
        setPhase('login');
        setMessages([]);
        setUsers([]);
        setUsername('');
        setMyStatus('ACTIVE');
        setActiveChat('ALL');
        setLoginError('⚠ Conexión perdida: el servidor se apagó o no está disponible.');
      }
    };
  }, [stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // ── Acciones ──────────────────────────────────────────────────────────────

  const sendBroadcast = useCallback((text) => {
    const me = usernameRef.current;
    send({ command: CMD.BROADCAST, sender: me, target: '', payload: text });
    addMessage({ type: 'broadcast', sender: me, target: 'ALL', text });
  }, [send, addMessage]);

  const sendDirect = useCallback((target, text) => {
    const me = usernameRef.current;
    send({ command: CMD.DIRECT, sender: me, target, payload: text });
    addMessage({ type: 'direct', sender: me, target, text });
  }, [send, addMessage]);

  const changeStatus = useCallback((status) => {
    setMyStatus(status);
    send({ command: CMD.STATUS, sender: usernameRef.current, target: '', payload: status });
  }, [send]);

  const listUsers = useCallback(() => {
    send({ command: CMD.LIST, sender: usernameRef.current, target: '', payload: '' });
  }, [send]);

  const getInfo = useCallback((target) => {
    send({ command: CMD.INFO, sender: usernameRef.current, target, payload: '' });
  }, [send]);

  const logout = useCallback(() => {
    voluntaryLogout.current = true;
    stopPolling();
    send({ command: CMD.LOGOUT, sender: usernameRef.current, target: '', payload: '' });
    ws.current?.close();
    usernameRef.current = '';
    setPhase('login');
    setMessages([]);
    setUsers([]);
    setUsername('');
    setMyStatus('ACTIVE');
    setActiveChat('ALL');
    setLoginError('');
  }, [send, stopPolling]);

  return {
    phase, username, myStatus, messages, users, activeChat, userInfo,
    wsStatus, loginError,
    connect, sendBroadcast, sendDirect, changeStatus, listUsers, getInfo, logout,
    setActiveChat, setUserInfo,
  };
}

import { useState, useRef, useCallback } from 'react';

const CMD = {
  REGISTER: 1, BROADCAST: 2, DIRECT: 3, LIST: 4,
  INFO: 5, STATUS: 6, LOGOUT: 7, OK: 8, ERROR: 9,
  MSG: 10, USER_LIST: 11, USER_INFO: 12, DISCONNECTED: 13,
};

const BRIDGE_URL = 'ws://localhost:4000';

// Patrones que el servidor puede mandar para indicar cambio de status
const STATUS_PATTERNS = {
  ACTIVE:   /activ/i,
  BUSY:     /ocup|busy/i,
  INACTIVE: /inactiv/i,
};

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
  // Flag para distinguir logout voluntario de caída del servidor
  const voluntaryLogout = useRef(false);

  const addMessage = useCallback((msg) => {
    setMessages(prev => [...prev, { ...msg, id: Date.now() + Math.random(), ts: new Date() }]);
  }, []);

  const send = useCallback((obj) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(obj));
    }
  }, []);

  const handlePacket = useCallback((pkt) => {
    const user = pendingUser.current;

    // Señal interna del bridge: TCP listo → registrar
    if (pkt.command === 0 && pkt.payload === 'tcp_ok') {
      ws.current.send(JSON.stringify({
        command: CMD.REGISTER,
        sender: user,
        target: '',
        payload: user,
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
        } else if (['ACTIVE', 'BUSY', 'INACTIVE'].includes(pkt.payload)) {
          // Confirmación de cambio de status manual
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

        // Detectar si el servidor nos avisa de un cambio de status automático
        // El servidor manda: sender="SERVER", payload="Tu status cambió a INACTIVE"
        if (pkt.sender === 'SERVER' && pkt.target === me) {
          for (const [status, pattern] of Object.entries(STATUS_PATTERNS)) {
            if (pattern.test(pkt.payload)) {
              setMyStatus(status);
              break;
            }
          }
        }

        // Ignorar eco de nuestros propios mensajes
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
  }, [addMessage]);

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

    socket.onmessage = (e) => {
      try { handlePacket(JSON.parse(e.data)); } catch {}
    };

    socket.onerror = () => {
      setWsStatus('disconnected');
      setLoginError('No se pudo conectar al bridge. ¿Está corriendo bridge.js?');
    };

    socket.onclose = () => {
      setWsStatus('disconnected');

      // Si había sesión activa y NO fue logout voluntario → servidor caído
      if (usernameRef.current && !voluntaryLogout.current) {
        // Volver al login con mensaje de error
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
  }, [handlePacket]);

  // ── Acciones ───────────────────────────────────────────────────────────────

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
    send({ command: CMD.STATUS, sender: usernameRef.current, target: '', payload: status });
  }, [send]);

  const listUsers = useCallback(() => {
    send({ command: CMD.LIST, sender: usernameRef.current, target: '', payload: '' });
  }, [send]);

  const getInfo = useCallback((target) => {
    send({ command: CMD.INFO, sender: usernameRef.current, target, payload: '' });
  }, [send]);

  const logout = useCallback(() => {
    voluntaryLogout.current = true; // marcar que fue intencional
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
  }, [send]);

  return {
    phase, username, myStatus, messages, users, activeChat, userInfo,
    wsStatus, loginError,
    connect, sendBroadcast, sendDirect, changeStatus, listUsers, getInfo, logout,
    setActiveChat, setUserInfo,
  };
}

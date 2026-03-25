import React, { useState, useEffect, useRef } from 'react';
import { useChat } from './useChat';
import styles from './App.module.css';

function statusColor(s) {
  if (s === 'ACTIVE') return 'var(--status-active)';
  if (s === 'BUSY')   return 'var(--status-busy)';
  return 'var(--status-inactive)';
}

function statusLabel(s) {
  if (s === 'ACTIVE')   return 'Activo';
  if (s === 'BUSY')     return 'Ocupado';
  if (s === 'INACTIVE') return 'Inactivo';
  return s;
}

function formatTime(date) {
  if (!date) return '';
  return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

// ── Login ────────────────────────────────────────────────────────────────────

function LoginScreen({ onConnect, loginError, wsStatus }) {
  const [user, setUser] = useState('');
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState('8080');

  const handleSubmit = (e) => {
    e.preventDefault();
    const u = user.trim(), h = host.trim(), p = port.trim();
    if (!u || !h || !p) return;
    onConnect(u, h, p);
  };

  const connecting = wsStatus === 'connecting';

  return (
    <div className={styles.loginWrap}>
      <div className={styles.loginNoise} />
      <div className={styles.loginCard}>
        <div className={styles.loginLogo}>
          <span className={styles.loginLogoIcon}>◈</span>
          <span className={styles.loginLogoText}>CHAT<span>UVG</span></span>
        </div>
        <p className={styles.loginSub}>Sistema de chat · Sistemas Operativos 2026</p>

        <form onSubmit={handleSubmit} className={styles.loginForm}>
          <div className={styles.loginField}>
            <label className={styles.loginLabel}>Usuario</label>
            <input
              className={styles.loginInput}
              type="text"
              placeholder="tu_nombre"
              value={user}
              onChange={e => setUser(e.target.value)}
              disabled={connecting}
              autoFocus
              maxLength={31}
            />
          </div>

          <div className={styles.loginRow}>
            <div className={styles.loginField} style={{ flex: 2 }}>
              <label className={styles.loginLabel}>IP del servidor</label>
              <input
                className={styles.loginInput}
                type="text"
                placeholder="127.0.0.1"
                value={host}
                onChange={e => setHost(e.target.value)}
                disabled={connecting}
              />
            </div>
            <div className={styles.loginField} style={{ flex: 1 }}>
              <label className={styles.loginLabel}>Puerto</label>
              <input
                className={styles.loginInput}
                type="text"
                placeholder="8080"
                value={port}
                onChange={e => setPort(e.target.value)}
                disabled={connecting}
                maxLength={5}
              />
            </div>
          </div>

          {loginError && <p className={styles.loginError}>{loginError}</p>}

          <button
            className={styles.loginBtn}
            type="submit"
            disabled={connecting || !user.trim() || !host.trim() || !port.trim()}
          >
            {connecting ? <span className={styles.loginSpinner}>●●●</span> : 'Conectar →'}
          </button>
        </form>

        <div className={styles.loginHint}>
          Bridge local: <code>ws://localhost:4000</code>
        </div>
      </div>
    </div>
  );
}

// ── Burbuja ──────────────────────────────────────────────────────────────────

function MessageBubble({ msg, isMe }) {
  if (msg.type === 'system') {
    return (
      <div className={styles.msgSystem}>
        <span>{msg.text}</span>
      </div>
    );
  }
  if (msg.type === 'error') {
    return (
      <div className={styles.msgSystemError}>
        <span>⚠ {msg.text}</span>
      </div>
    );
  }

  const isDirect = msg.type === 'direct';

  return (
    <div className={`${styles.msgRow} ${isMe ? styles.msgRowMe : ''}`}>
      {!isMe && (
        <div className={styles.msgAvatar}>
          {msg.sender.charAt(0).toUpperCase()}
        </div>
      )}
      <div className={styles.msgBubbleWrap}>
        {!isMe && (
          <span className={styles.msgSender}>
            {msg.sender}
            {isDirect && <span className={styles.dmTag}>DM</span>}
          </span>
        )}
        <div className={`${styles.msgBubble} ${isMe ? styles.msgBubbleMe : styles.msgBubbleOther} ${isDirect && !isMe ? styles.msgBubbleDm : ''}`}>
          <span className={styles.msgText}>{msg.text}</span>
          <span className={styles.msgTime}>{formatTime(msg.ts)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Modal info ───────────────────────────────────────────────────────────────

function UserInfoModal({ info, onClose }) {
  if (!info) return null;
  const [ip, status] = info.raw.split(',');
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span>Info de usuario</span>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.modalRow}>
            <span className={styles.modalKey}>Usuario</span>
            <span className={styles.modalVal}>{info.target}</span>
          </div>
          <div className={styles.modalRow}>
            <span className={styles.modalKey}>IP</span>
            <span className={styles.modalVal}><code>{ip}</code></span>
          </div>
          <div className={styles.modalRow}>
            <span className={styles.modalKey}>Estado</span>
            <span className={styles.modalVal} style={{ color: statusColor(status) }}>
              ● {statusLabel(status)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Ayuda ────────────────────────────────────────────────────────────────────

function HelpModal({ onClose }) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={e => e.stopPropagation()} style={{ width: 460 }}>
        <div className={styles.modalHeader}>
          <span>Ayuda</span>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.modalRow}><span className={styles.modalKey}>Broadcast</span><span className={styles.modalVal}>Escribe en el canal <b>#General</b></span></div>
          <div className={styles.modalRow}><span className={styles.modalKey}>Mensaje directo</span><span className={styles.modalVal}>Clic en un usuario del sidebar</span></div>
          <div className={styles.modalRow}><span className={styles.modalKey}>Cambiar estado</span><span className={styles.modalVal}>Clic en tu estado (● Activo ▾)</span></div>
          <div className={styles.modalRow}><span className={styles.modalKey}>Lista de usuarios</span><span className={styles.modalVal}>Sidebar, o botón ↻ para refrescar</span></div>
          <div className={styles.modalRow}><span className={styles.modalKey}>Info de usuario</span><span className={styles.modalVal}>Botón ⓘ junto a cada usuario</span></div>
          <div className={styles.modalRow}><span className={styles.modalKey}>Salir</span><span className={styles.modalVal}>Botón ⏻ arriba a la izquierda</span></div>
        </div>
      </div>
    </div>
  );
}

// ── Chat ─────────────────────────────────────────────────────────────────────

function ChatScreen({ hook }) {
  const {
    username, myStatus, messages, users, activeChat, userInfo,
    sendBroadcast, sendDirect, changeStatus, listUsers, getInfo, logout,
    setActiveChat, setUserInfo,
  } = hook;

  const [input, setInput] = useState('');
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const visibleMessages = messages.filter(m => {
    if (activeChat === 'ALL') {
      return m.type === 'broadcast' || m.type === 'system' || m.type === 'error';
    }
    return m.type === 'direct' && (
      (m.sender === activeChat && m.target === username) ||
      (m.sender === username && m.target === activeChat)
    );
  });

  const handleSend = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    if (activeChat === 'ALL') sendBroadcast(text);
    else sendDirect(activeChat, text);
    setInput('');
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); }
  };

  return (
    <div className={styles.chatWrap}>
      <UserInfoModal info={userInfo} onClose={() => setUserInfo(null)} />
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.myProfile}>
          <div className={styles.myAvatar}>
            {username.charAt(0).toUpperCase()}
            <span className={styles.myAvatarDot} style={{ background: statusColor(myStatus) }} />
          </div>
          <div className={styles.myInfo}>
            <span className={styles.myName}>{username}</span>
            <button
              className={styles.myStatus}
              style={{ color: statusColor(myStatus) }}
              onClick={() => setShowStatusMenu(v => !v)}
            >
              ● {statusLabel(myStatus)} ▾
            </button>
            {showStatusMenu && (
              <div className={styles.statusMenu}>
                {['ACTIVE', 'BUSY', 'INACTIVE'].map(s => (
                  <button key={s} className={styles.statusMenuItem} style={{ color: statusColor(s) }}
                    onClick={() => { changeStatus(s); setShowStatusMenu(false); }}>
                    ● {statusLabel(s)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className={styles.logoutBtn} onClick={() => setShowHelp(true)} title="Ayuda" style={{ fontSize: 14 }}>?</button>
          <button className={styles.logoutBtn} onClick={logout} title="Salir">⏻</button>
        </div>

        <div className={styles.sideSection}>
          <span className={styles.sideSectionTitle}>Canales</span>
          <button
            className={`${styles.sideItem} ${activeChat === 'ALL' ? styles.sideItemActive : ''}`}
            onClick={() => setActiveChat('ALL')}
          >
            <span className={styles.sideItemIcon}>#</span>
            <span>General</span>
          </button>
        </div>

        <div className={styles.sideSection} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className={styles.sideSectionHeader}>
            <span className={styles.sideSectionTitle}>Usuarios ({users.length})</span>
            <button className={styles.refreshBtn} onClick={listUsers} title="Actualizar">↻</button>
          </div>
          <div className={styles.userList}>
            {users.map(u => (
              <div key={u.name} className={`${styles.userItem} ${activeChat === u.name ? styles.userItemActive : ''}`}>
                <button className={styles.userItemBtn} onClick={() => setActiveChat(u.name)}>
                  <span className={styles.userDot} style={{ background: statusColor(u.status) }} />
                  <span className={styles.userName}>{u.name}</span>
                  {u.name === username && <span className={styles.youTag}>tú</span>}
                </button>
                <button className={styles.userInfoBtn} onClick={() => getInfo(u.name)} title="Ver info">ⓘ</button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className={styles.main}>
        <div className={styles.mainHeader}>
          <div className={styles.mainHeaderLeft}>
            <span className={styles.mainHeaderIcon}>{activeChat === 'ALL' ? '#' : '@'}</span>
            <span className={styles.mainHeaderTitle}>{activeChat === 'ALL' ? 'General' : activeChat}</span>
            {activeChat !== 'ALL' && (
              <span className={styles.mainHeaderSub}>
                {statusLabel(users.find(u => u.name === activeChat)?.status || '')}
              </span>
            )}
          </div>
          <div className={styles.mainHeaderRight}>
            {activeChat !== 'ALL' && (
              <button className={styles.headerInfoBtn} onClick={() => getInfo(activeChat)}>Ver info</button>
            )}
          </div>
        </div>

        <div className={styles.messages}>
          {visibleMessages.length === 0 && (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>◈</span>
              <span>{activeChat === 'ALL' ? 'No hay mensajes aún. ¡Di hola!' : `Inicia una conversación con ${activeChat}`}</span>
            </div>
          )}
          {visibleMessages.map(m => (
            <MessageBubble key={m.id} msg={m} isMe={m.sender === username} />
          ))}
          <div ref={bottomRef} />
        </div>

        <form className={styles.inputBar} onSubmit={handleSend}>
          <input
            className={styles.inputField}
            placeholder={activeChat === 'ALL' ? 'Mensaje a todos…' : `Mensaje a ${activeChat}…`}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            autoFocus
          />
          <button className={styles.sendBtn} type="submit" disabled={!input.trim()}>➤</button>
        </form>
      </main>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const hook = useChat();
  if (hook.phase === 'login') {
    return <LoginScreen onConnect={hook.connect} loginError={hook.loginError} wsStatus={hook.wsStatus} />;
  }
  return <ChatScreen hook={hook} />;
}

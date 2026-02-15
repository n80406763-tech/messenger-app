const authPanel = document.getElementById('authPanel');
const chatPanel = document.getElementById('chatPanel');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const authMessage = document.getElementById('authMessage');
const chatMessage = document.getElementById('chatMessage');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const logoutBtn = document.getElementById('logoutBtn');
const messagesEl = document.getElementById('messages');
const meLabel = document.getElementById('meLabel');
const connBadge = document.getElementById('connBadge');
const onlineBadge = document.getElementById('onlineBadge');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');

let token = localStorage.getItem('messenger_token') || '';
let currentUser = null;
let streamAbortController = null;
let reconnectTimer = null;

function setAuthMessage(text, isError = false) {
  authMessage.textContent = text;
  authMessage.style.color = isError ? '#b42318' : '#6d7687';
}

function setChatMessage(text, isError = false) {
  chatMessage.textContent = text;
  chatMessage.style.color = isError ? '#b42318' : '#6d7687';
}

function setConnectionState(online) {
  connBadge.textContent = online ? 'online' : 'offline';
  connBadge.classList.toggle('online', online);
}

function setOnlineCount(count) {
  onlineBadge.textContent = `онлайн: ${count}`;
}

function renderMessage(message) {
  const div = document.createElement('div');
  div.className = 'msg';
  if (currentUser && message.sender === currentUser.username) {
    div.classList.add('my');
  }

  const meta = document.createElement('div');
  meta.className = 'meta';

  const dt = new Date(message.createdAt);
  const dateLabel = Number.isNaN(dt.getTime()) ? message.createdAt : dt.toLocaleString();
  meta.textContent = `${message.sender} • ${dateLabel}`;

  const text = document.createElement('div');
  text.textContent = message.text;

  div.append(meta, text);
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(path, { ...options, headers });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function clearRealtime() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (streamAbortController) {
    streamAbortController.abort();
    streamAbortController = null;
  }
}

async function connectRealtime() {
  clearRealtime();
  streamAbortController = new AbortController();

  try {
    const response = await fetch('/api/events', {
      headers: { Authorization: `Bearer ${token}` },
      signal: streamAbortController.signal
    });

    if (!response.ok || !response.body) {
      throw new Error('Не удалось подключиться к realtime-каналу');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    setConnectionState(true);
    setChatMessage('Подключено к realtime');

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        throw new Error('Соединение закрыто');
      }

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() || '';

      chunks.forEach((chunk) => {
        const eventLine = chunk
          .split('\n')
          .find((line) => line.startsWith('event: '));
        const dataLine = chunk
          .split('\n')
          .find((line) => line.startsWith('data: '));

        if (!eventLine || !dataLine) return;

        const event = eventLine.replace('event: ', '');
        const rawData = dataLine.replace('data: ', '');

        if (event === 'ping' || event === 'ready') return;

        if (event === 'message') {
          try {
            const message = JSON.parse(rawData);
            renderMessage(message);
          } catch {
            // noop
          }
          return;
        }

        if (event === 'presence') {
          try {
            const presence = JSON.parse(rawData);
            setOnlineCount(presence.count || 0);
          } catch {
            // noop
          }
        }
      });
    }
  } catch {
    if (!token) return;
    setConnectionState(false);
    setChatMessage('Realtime отключён, переподключаемся...', true);
    reconnectTimer = setTimeout(() => {
      connectRealtime().catch(() => {});
    }, 1500);
  }
}

async function enterChat(user) {
  currentUser = user;
  authPanel.classList.add('hidden');
  chatPanel.classList.remove('hidden');
  meLabel.textContent = `Вы: ${user.username}`;

  const { messages } = await api('/api/messages');
  messagesEl.innerHTML = '';
  messages.forEach(renderMessage);

  const online = await api('/api/online');
  setOnlineCount(online.count || 0);

  await connectRealtime();
}

function resetAuthUI() {
  currentUser = null;
  token = '';
  localStorage.removeItem('messenger_token');
  clearRealtime();
  setConnectionState(false);
  setOnlineCount(0);
  setChatMessage('');
  messagesEl.innerHTML = '';
  chatPanel.classList.add('hidden');
  authPanel.classList.remove('hidden');
}

async function auth(mode) {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    setAuthMessage('Введите логин и пароль', true);
    return;
  }

  try {
    setAuthMessage('Загрузка...');

    if (mode === 'register') {
      await api('/api/register', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      setAuthMessage('Регистрация успешна. Выполняем вход...');
    }

    const loginData = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    token = loginData.token;
    localStorage.setItem('messenger_token', token);

    setAuthMessage('');
    await enterChat(loginData.user);
  } catch (error) {
    setAuthMessage(error.message, true);
  }
}

async function restoreSession() {
  if (!token) return;

  try {
    const { user } = await api('/api/me');
    await enterChat(user);
  } catch {
    resetAuthUI();
  }
}

async function logout() {
  if (!token) {
    resetAuthUI();
    return;
  }

  try {
    await api('/api/logout', { method: 'POST' });
  } catch {
    // ignore
  }

  resetAuthUI();
  setAuthMessage('Вы вышли из аккаунта');
}

loginBtn.addEventListener('click', () => auth('login'));
registerBtn.addEventListener('click', () => auth('register'));
logoutBtn.addEventListener('click', logout);

messageForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;

  try {
    await api('/api/messages', {
      method: 'POST',
      body: JSON.stringify({ text })
    });
    messageInput.value = '';
    setChatMessage('');
  } catch (error) {
    setChatMessage(error.message, true);
  }
});

window.addEventListener('beforeunload', clearRealtime);
restoreSession().catch(() => {});

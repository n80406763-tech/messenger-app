const authPanel = document.getElementById('authPanel');
const chatPanel = document.getElementById('chatPanel');
const loginPage = document.getElementById('loginPage');
const registerPage = document.getElementById('registerPage');
const recoveryPage = document.getElementById('recoveryPage');
const showLoginPageBtn = document.getElementById('showLoginPageBtn');
const showRegisterPageBtn = document.getElementById('showRegisterPageBtn');
const showRecoveryPageBtn = document.getElementById('showRecoveryPageBtn');
const goRegisterFromLoginBtn = document.getElementById('goRegisterFromLoginBtn');
const goLoginFromRegisterBtn = document.getElementById('goLoginFromRegisterBtn');

const loginUsernameInput = document.getElementById('loginUsername');
const loginPasswordInput = document.getElementById('loginPassword');
const registerUsernameInput = document.getElementById('registerUsername');
const registerPasswordInput = document.getElementById('registerPassword');
const registerFullNameInput = document.getElementById('registerFullName');
const registerEmailInput = document.getElementById('registerEmail');
const registerSecurityQuestionInput = document.getElementById('registerSecurityQuestion');
const registerSecurityAnswerInput = document.getElementById('registerSecurityAnswer');
const recoverUsernameInput = document.getElementById('recoverUsername');
const recoverEmailInput = document.getElementById('recoverEmail');
const recoverSecurityAnswerInput = document.getElementById('recoverSecurityAnswer');
const guestSupportTextInput = document.getElementById('guestSupportText');

const authMessage = document.getElementById('authMessage');
const chatMessage = document.getElementById('chatMessage');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
const guestSupportBtn = document.getElementById('guestSupportBtn');
const openSettingsBtn = document.getElementById('openSettingsBtn');
const logoutBtn = document.getElementById('logoutBtn');
const conversationSearchInput = document.getElementById('conversationSearchInput');
const userSearchInput = document.getElementById('userSearchInput');
const userSearchResults = document.getElementById('userSearchResults');
const contactsList = document.getElementById('contactsList');
const openCreateGroupBtn = document.getElementById('openCreateGroupBtn');
const openGroupSettingsBtn = document.getElementById('openGroupSettingsBtn');
const supportChatBtn = document.getElementById('supportChatBtn');
const supportChatBtnTab = document.getElementById('supportChatBtnTab');
const groupInvitesBox = document.getElementById('groupInvitesBox');
const conversationsList = document.getElementById('conversationsList');
const dialogTitle = document.getElementById('dialogTitle');
const dialogMeta = document.getElementById('dialogMeta');
const supportActions = document.getElementById('supportActions');
const connBadge = document.getElementById('connBadge');
const loadOlderBtn = document.getElementById('loadOlderBtn');
const messagesEl = document.getElementById('messages');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const mediaInput = document.getElementById('mediaInput');
const mediaPreview = document.getElementById('mediaPreview');
const meLabel = document.getElementById('meLabel');
const toastContainer = document.getElementById('toastContainer');

const tabChatsBtn = document.getElementById('tabChatsBtn');
const tabContactsBtn = document.getElementById('tabContactsBtn');
const tabSettingsBtn = document.getElementById('tabSettingsBtn');
const chatsSection = document.getElementById('chatsSection');
const chatsSectionActions = document.getElementById('chatsSectionActions');
const contactsSection = document.getElementById('contactsSection');
const settingsSection = document.getElementById('settingsSection');
const openSettingsBtnTab = document.getElementById('openSettingsBtnTab');
const logoutBtnTab = document.getElementById('logoutBtnTab');
const backToListBtn = document.getElementById('backToListBtn');

const groupModal = document.getElementById('groupModal');
const groupModalTitle = document.getElementById('groupModalTitle');
const groupTitleInput = document.getElementById('groupTitleInput');
const groupMemberSearchInput = document.getElementById('groupMemberSearchInput');
const groupMemberCandidates = document.getElementById('groupMemberCandidates');
const selectedGroupMembers = document.getElementById('selectedGroupMembers');
const saveGroupBtn = document.getElementById('saveGroupBtn');
const cancelGroupBtn = document.getElementById('cancelGroupBtn');
const contactAliasModal = document.getElementById('contactAliasModal');
const contactAliasHint = document.getElementById('contactAliasHint');
const contactAliasInput = document.getElementById('contactAliasInput');
const saveContactAliasBtn = document.getElementById('saveContactAliasBtn');
const cancelContactAliasBtn = document.getElementById('cancelContactAliasBtn');

const requiredProfileModal = document.getElementById('requiredProfileModal');
const requiredFullNameInput = document.getElementById('requiredFullName');
const requiredEmailInput = document.getElementById('requiredEmail');
const requiredSecurityQuestionInput = document.getElementById('requiredSecurityQuestion');
const requiredSecurityAnswerInput = document.getElementById('requiredSecurityAnswer');
const saveRequiredProfileBtn = document.getElementById('saveRequiredProfileBtn');

const settingsModal = document.getElementById('settingsModal');
const avatarInput = document.getElementById('avatarInput');
const avatarPreview = document.getElementById('avatarPreview');
const hideNameCheckbox = document.getElementById('hideNameCheckbox');
const showOnlineStatusCheckbox = document.getElementById('showOnlineStatusCheckbox');
const allowAvatarViewCheckbox = document.getElementById('allowAvatarViewCheckbox');
const allowAvatarDownloadCheckbox = document.getElementById('allowAvatarDownloadCheckbox');
const supportAdminPanel = document.getElementById('supportAdminPanel');
const supportAgentUsername = document.getElementById('supportAgentUsername');
const supportAgentPassword = document.getElementById('supportAgentPassword');
const createSupportAgentBtn = document.getElementById('createSupportAgentBtn');
const supportAgentsList = document.getElementById('supportAgentsList');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
const togglePushBtn = document.getElementById('togglePushBtn');
const pushStatus = document.getElementById('pushStatus');
const themeSelect = document.getElementById('themeSelect');
const compactModeCheckbox = document.getElementById('compactModeCheckbox');
const mediaViewerModal = document.getElementById('mediaViewerModal');
const mediaViewerBody = document.getElementById('mediaViewerBody');
const closeMediaViewerBtn = document.getElementById('closeMediaViewerBtn');

let token = localStorage.getItem('messenger_token') || '';
let currentUser = null;
let conversations = [];
let activeConversation = null;
let hasOlder = false;
let streamAbortController = null;
let reconnectTimer = null;
let allUsersCache = [];
let selectedGroupMemberIds = new Set();
let supportCategories = [];
let contactAliases = JSON.parse(localStorage.getItem('messenger_contact_aliases') || '{}');
let groupModalMode = 'create';
let selectedAvatarDataUrl = undefined;
const shownNotificationIds = new Set();
const renderedMessageIds = new Set();
let isSendingMessage = false;
let conversationSyncTimer = null;
let requiredProfilePromise = null;
let pendingAliasUser = null;
let pendingDirectUserId = null;
let contactsCache = [];

function setAuthMessage(text, isError = false) {
  authMessage.textContent = text;
  authMessage.style.color = isError ? '#b91c1c' : '#6b7280';
}

function setChatMessage(text, isError = false) {
  chatMessage.textContent = text;
  chatMessage.style.color = isError ? '#b91c1c' : '#6b7280';
}

function setConnectionState(online) {
  connBadge.textContent = online ? 'online' : 'offline';
  connBadge.style.background = online ? '#dcfce7' : '#e5e7eb';
}

async function forceAppUpdateCheck() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) await registration.update();
  } catch {
    // ignore update check errors
  }
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function clearRealtime() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  if (streamAbortController) streamAbortController.abort();
  streamAbortController = null;
  if (conversationSyncTimer) clearInterval(conversationSyncTimer);
  conversationSyncTimer = null;
}

function showToast(text) {
  if (!toastContainer || !text) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  toastContainer.appendChild(el);

  setTimeout(() => {
    el.classList.add('hide');
    setTimeout(() => el.remove(), 250);
  }, 2600);
}

function setSidebarTab(tab) {
  const isChats = tab === 'chats';
  const isContacts = tab === 'contacts';
  const isSettings = tab === 'settings';

  tabChatsBtn?.classList.toggle('active', isChats);
  tabContactsBtn?.classList.toggle('active', isContacts);
  tabSettingsBtn?.classList.toggle('active', isSettings);

  chatsSection?.classList.toggle('hidden', !isChats);
  chatsSectionActions?.classList.toggle('hidden', !isChats);
  contactsSection?.classList.toggle('hidden', !isContacts);
  settingsSection?.classList.toggle('hidden', !isSettings);

  if (isMobileLayout() && !isChats) setMobileDialogMode(false);
}


function isMobileLayout() {
  return window.matchMedia('(max-width: 700px)').matches;
}

function setMobileDialogMode(inDialog) {
  if (!chatPanel) return;

  if (!isMobileLayout()) {
    chatPanel.classList.remove('dialog-only');
    backToListBtn?.classList.add('hidden');
    return;
  }

  chatPanel.classList.toggle('dialog-only', Boolean(inDialog));
  backToListBtn?.classList.toggle('hidden', !inDialog);
}

function applyTheme(theme) {
  document.documentElement.classList.toggle('theme-dark', theme === 'dark');
}

function applyCompactMode(enabled) {
  document.body.classList.toggle('compact-ui', Boolean(enabled));
}

function initUiSettings() {
  const savedTheme = localStorage.getItem('messenger_theme') || 'light';
  const compact = localStorage.getItem('messenger_compact_ui') === '1';
  if (themeSelect) themeSelect.value = savedTheme;
  if (compactModeCheckbox) compactModeCheckbox.checked = compact;
  applyTheme(savedTheme);
  applyCompactMode(compact);
}


function maybeShowForegroundNotification(message) {
  if (!message || !currentUser) return;
  if (message.senderId === currentUser.id) return;

  const preview = `${message.sender || 'NMS'}: ${message.text || (message.attachment ? '📎 Медиа-сообщение' : 'Новое сообщение')}`;
  showToast(preview);

  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (shownNotificationIds.has(message.id)) return;

  shownNotificationIds.add(message.id);
  if (shownNotificationIds.size > 300) {
    const first = shownNotificationIds.values().next().value;
    shownNotificationIds.delete(first);
  }

  const title = message.sender || 'NMS';
  const body = message.text || (message.attachment ? '📎 Медиа-сообщение' : 'Новое сообщение');
  try {
    const n = new Notification(title, {
      body,
      icon: '/icon-192.svg',
      badge: '/icon-192.svg'
    });
    n.onclick = () => window.focus();
  } catch {
    // Ignore browser-level notification errors.
  }
}

function avatarNode(user, size = 28) {
  if (user.avatar) {
    const img = document.createElement('img');
    img.className = 'avatar';
    img.style.width = `${size}px`;
    img.style.height = `${size}px`;
    img.src = user.avatar;
    return img;
  }
  const div = document.createElement('div');
  div.className = 'avatar';
  div.style.width = `${size}px`;
  div.style.height = `${size}px`;
  div.textContent = (user.username || '?').slice(0, 1).toUpperCase();
  return div;
}

function filteredConversations() {
  const q = conversationSearchInput.value.trim().toLowerCase();
  return conversations.filter((c) => (q ? c.title.toLowerCase().includes(q) : true));
}


function aliasForUser(user) {
  const key = user?.handle || user?.username || '';
  return key && contactAliases[key] ? contactAliases[key] : (user?.username || '');
}

function conversationTitle(conv) {
  if (conv.type !== 'direct') return conv.title;
  const peer = (conv.participants || []).find((p) => p.id !== currentUser?.id);
  return peer ? aliasForUser(peer) : conv.title;
}

function messageSenderLabel(message) {
  if (message.senderId && message.senderId === currentUser?.id) return 'Вы';
  if (activeConversation?.type === 'support') return message.sender;
  const participant = (activeConversation?.participants || []).find((p) => p.id === message.senderId);
  return participant ? aliasForUser(participant) : message.sender;
}

function setAliasForUser(user) {
  const key = user?.handle || user?.username || '';
  if (!key) return;
  const current = contactAliases[key] || user.username;
  contactAliasHint.textContent = `Аккаунт: @${key}. Это имя увидите только вы.`;
  contactAliasInput.value = current;
  pendingAliasUser = user;
  contactAliasModal.classList.remove('hidden');
  contactAliasInput.focus();
}

function closeAliasModal() {
  pendingAliasUser = null;
  pendingDirectUserId = null;
  contactAliasModal.classList.add('hidden');
}

function persistAlias(user, aliasValue) {
  const key = user?.handle || user?.username || '';
  if (!key) return;
  const trimmed = aliasValue.trim();
  if (!trimmed) delete contactAliases[key];
  else contactAliases[key] = trimmed;
  localStorage.setItem('messenger_contact_aliases', JSON.stringify(contactAliases));
  renderSearchResults(allUsersCache.filter((u) => userSearchInput.value.trim() ? u.username.toLowerCase().includes(userSearchInput.value.trim().toLowerCase()) : false));
  renderConversationList();
  renderContactsList();
  if (activeConversation) {
    dialogTitle.textContent = conversationTitle(activeConversation);
  }
}

function renderConversationList() {
  conversationsList.innerHTML = '';

  filteredConversations().forEach((conv) => {
    const el = document.createElement('div');
    el.className = 'conv-item';
    if (activeConversation && activeConversation.id === conv.id) el.classList.add('active');

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';

    const titleStrong = document.createElement('strong');
    titleStrong.textContent = conversationTitle(conv);

    const online = document.createElement('span');
    online.className = 'muted';
    online.textContent = `${conv.onlineCount || 0} online`;

    header.append(titleStrong, online);

    const last = document.createElement('div');
    last.className = 'muted';
    last.textContent = conv.lastMessage?.text || (conv.lastMessage?.attachment ? 'Медиа' : '');

    el.append(header, last);
    el.addEventListener('click', () => openConversation(conv.id));
    conversationsList.appendChild(el);
  });
}


function renderContactsList() {
  if (!contactsList) return;
  contactsList.innerHTML = '';

  const directContacts = contactsCache.length
    ? contactsCache
    : conversations
        .filter((c) => c.type === 'direct')
        .map((c) => (c.participants || []).find((p) => p.id !== currentUser?.id))
        .filter(Boolean);

  const uniqueById = new Map();
  directContacts.forEach((u) => {
    if (!uniqueById.has(u.id)) uniqueById.set(u.id, u);
  });

  if (!uniqueById.size) {
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = 'Пока нет контактов. Найдите человека ниже и начните диалог.';
    contactsList.appendChild(empty);
    return;
  }

  for (const u of uniqueById.values()) {
    const el = document.createElement('div');
    el.className = 'search-item';

    const left = document.createElement('div');
    left.style.display = 'flex';
    left.style.gap = '8px';
    left.style.alignItems = 'center';
    left.appendChild(avatarNode(u));

    const info = document.createElement('div');
    const name = document.createElement('div');
    name.textContent = aliasForUser(u);
    const meta = document.createElement('div');
    meta.className = 'muted';
    meta.textContent = `@${u.handle || u.username}`;
    info.append(name, meta);
    left.append(info);

    const renameBtn = document.createElement('button');
    renameBtn.type = 'button';
    renameBtn.className = 'ghost';
    renameBtn.textContent = 'Переименовать';
    renameBtn.addEventListener('click', () => setAliasForUser(u));

    el.append(left, renameBtn);
    contactsList.appendChild(el);
  }
}

function openMediaViewer(attachment) {
  if (!attachment?.dataUrl || !attachment?.type) return;
  mediaViewerBody.innerHTML = '';
  if (attachment.type === 'image') {
    const img = document.createElement('img');
    img.src = attachment.dataUrl;
    mediaViewerBody.appendChild(img);
  } else if (attachment.type === 'video') {
    const video = document.createElement('video');
    video.src = attachment.dataUrl;
    video.controls = true;
    video.autoplay = true;
    mediaViewerBody.appendChild(video);
  }
  mediaViewerModal.classList.remove('hidden');
}

function closeMediaViewer() {
  mediaViewerModal.classList.add('hidden');
  mediaViewerBody.innerHTML = '';
}

function messageNode(message) {
  const box = document.createElement('div');
  box.className = 'msg';
  box.dataset.id = String(message.id);
  if (currentUser && message.senderId === currentUser.id) box.classList.add('my');

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = `${messageSenderLabel(message)} • ${new Date(message.createdAt).toLocaleString()}`;
  box.appendChild(meta);

  if (message.text) {
    const text = document.createElement('div');
    text.textContent = message.text;
    box.appendChild(text);
  }

  if (message.attachment) {
    if (message.attachment.type === 'image') {
      const img = document.createElement('img');
      img.src = message.attachment.dataUrl;
      img.addEventListener('click', () => openMediaViewer(message.attachment));
      box.appendChild(img);
    }
    if (message.attachment.type === 'video') {
      const video = document.createElement('video');
      video.src = message.attachment.dataUrl;
      video.controls = true;
      box.appendChild(video);

      const fullBtn = document.createElement('button');
      fullBtn.type = 'button';
      fullBtn.className = 'ghost media-full-btn';
      fullBtn.textContent = 'Открыть видео на весь экран';
      fullBtn.addEventListener('click', () => openMediaViewer(message.attachment));
      box.appendChild(fullBtn);
    }
  }

  return box;
}

function appendMessage(message, scroll = true) {
  if (!message || !message.id) return;
  if (renderedMessageIds.has(message.id)) return;
  renderedMessageIds.add(message.id);
  messagesEl.appendChild(messageNode(message));
  if (scroll) messagesEl.scrollTop = messagesEl.scrollHeight;
}

function prependMessages(messages) {
  if (!messages.length) return;
  const before = messagesEl.scrollHeight;
  messages.forEach((m) => {
    if (!m || !m.id || renderedMessageIds.has(m.id)) return;
    renderedMessageIds.add(m.id);
    messagesEl.insertBefore(messageNode(m), messagesEl.firstChild);
  });
  messagesEl.scrollTop += messagesEl.scrollHeight - before;
}

function activeFirstId() {
  const first = messagesEl.querySelector('.msg');
  return first ? Number(first.dataset.id || '0') : 0;
}

function renderSupportActions(show) {
  supportActions.innerHTML = '';
  supportActions.classList.toggle('hidden', !show);
  if (!show) return;

  supportCategories.forEach((category) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = category;
    btn.addEventListener('click', () => {
      sendSupportComplaint(category).catch((e) => setChatMessage(e.message, true));
    });
    supportActions.appendChild(btn);
  });
}

function setDialogMeta(conv) {
  dialogMeta.textContent =
    conv.type === 'group'
      ? `Группа • онлайн ${conv.onlineCount} • участников ${conv.participantIds.length}`
      : conv.type === 'support'
        ? 'Поддержка • выберите категорию обращения ниже'
        : 'Личный чат';

  openGroupSettingsBtn.classList.toggle('hidden', conv.type !== 'group');
  renderSupportActions(conv.type === 'support');
}

async function loadConversations() {
  const data = await api('/api/conversations');
  conversations = data.conversations || [];
  await refreshContactsCache();
  renderConversationList();
  renderContactsList();
  await loadGroupInvites();
}

async function openConversation(conversationId) {
  const conv = conversations.find((c) => c.id === conversationId);
  if (!conv) return;
  activeConversation = conv;
  renderConversationList();

  dialogTitle.textContent = conversationTitle(conv);
  setDialogMeta(conv);

  const data = await api(`/api/conversations/${conv.id}/messages?limit=30`);
  messagesEl.innerHTML = '';
  renderedMessageIds.clear();
  (data.messages || []).forEach((m) => appendMessage(m));

  hasOlder = Boolean(data.hasMore);
  loadOlderBtn.classList.toggle('hidden', !hasOlder);
  setMobileDialogMode(true);
}

async function loadOlderMessages() {
  if (!activeConversation || !hasOlder) return;
  const firstId = activeFirstId();
  if (!firstId) return;

  loadOlderBtn.textContent = 'Загрузка...';
  loadOlderBtn.disabled = true;
  try {
    const data = await api(
      `/api/conversations/${activeConversation.id}/messages?limit=30&before_id=${firstId}`
    );
    prependMessages(data.messages || []);
    hasOlder = Boolean(data.hasMore);
    loadOlderBtn.classList.toggle('hidden', !hasOlder);
  } finally {
    loadOlderBtn.textContent = 'Загрузить старые сообщения';
    loadOlderBtn.disabled = false;
  }
}


async function syncActiveConversationMessages() {
  if (!token || !activeConversation) return;

  try {
    const data = await api(`/api/conversations/${activeConversation.id}/messages?limit=30`);
    const incoming = data.messages || [];

    for (const msg of incoming) {
      if (!msg?.id || renderedMessageIds.has(msg.id)) continue;
      appendMessage(msg, false);
    }

    if (incoming.length) messagesEl.scrollTop = messagesEl.scrollHeight;
    hasOlder = Boolean(data.hasMore);
    loadOlderBtn.classList.toggle('hidden', !hasOlder);
  } catch {
    // silent fallback sync
  }
}

function startConversationSync() {
  if (conversationSyncTimer) clearInterval(conversationSyncTimer);
  conversationSyncTimer = setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    syncActiveConversationMessages().catch(() => {});
  }, 3500);
}

async function connectRealtime() {
  clearRealtime();
  streamAbortController = new AbortController();

  try {
    const res = await fetch('/api/events', {
      headers: { Authorization: `Bearer ${token}` },
      signal: streamAbortController.signal
    });
    if (!res.ok || !res.body) throw new Error('Realtime failed');

    setConnectionState(true);
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) throw new Error('Stream closed');

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() || '';

      for (const chunk of chunks) {
        const eventLine = chunk.split('\n').find((l) => l.startsWith('event: '));
        const dataLine = chunk.split('\n').find((l) => l.startsWith('data: '));
        if (!eventLine || !dataLine) continue;

        const event = eventLine.replace('event: ', '');
        const payload = JSON.parse(dataLine.replace('data: ', ''));

        if (event === 'message') {
          maybeShowForegroundNotification(payload);
          if (activeConversation && payload.conversationId === activeConversation.id) appendMessage(payload);
          await loadConversations();
        }

        if (event === 'presence') {
          conversations = conversations.map((c) =>
            c.id === payload.conversationId ? { ...c, onlineCount: payload.onlineCount } : c
          );
          renderConversationList();
          if (activeConversation && activeConversation.id === payload.conversationId) {
            activeConversation = conversations.find((c) => c.id === payload.conversationId) || activeConversation;
            setDialogMeta(activeConversation);
          }
        }

        if (event === 'conversation_updated') {
          const idx = conversations.findIndex((c) => c.id === payload.id);
          if (idx >= 0) conversations[idx] = payload;
          else conversations.unshift(payload);
          renderConversationList();

          if (activeConversation && activeConversation.id === payload.id) {
            activeConversation = payload;
            dialogTitle.textContent = payload.title;
            setDialogMeta(payload);
          }
        }
      }
    }
  } catch {
    streamAbortController = null;
    if (!token) return;
    setConnectionState(false);
    reconnectTimer = setTimeout(() => connectRealtime().catch(() => {}), 1500);
  }
}

async function openDirectWithUser(user) {
  const aliasKey = user.handle || user.username || '';
  if (aliasKey && !contactAliases[aliasKey]) {
    contactAliasHint.textContent = `Как назвать контакт @${aliasKey} у вас?`;
    contactAliasInput.value = user.username || aliasKey;
    pendingAliasUser = user;
    pendingDirectUserId = user.id;
    contactAliasModal.classList.remove('hidden');
    contactAliasInput.focus();
    return;
  }
  const data = await api('/api/conversations/direct', {
    method: 'POST',
    body: JSON.stringify({ targetUserId: user.id })
  });
  await loadConversations();
  await openConversation(data.conversation.id);
}

function renderSearchResults(users) {
  userSearchResults.innerHTML = '';
  if (!users.length) {
    const hint = document.createElement('div');
    hint.className = 'muted';
    hint.textContent = 'Можно добавить только людей из контактов и только после их согласия.';
    groupMemberCandidates.appendChild(hint);
    return;
  }

  users.forEach((u) => {
    const el = document.createElement('div');
    el.className = 'search-item';

    const left = document.createElement('div');
    left.style.display = 'flex';
    left.style.gap = '8px';
    left.style.alignItems = 'center';
    left.appendChild(avatarNode(u));

    const info = document.createElement('div');
    const name = document.createElement('div');
    name.textContent = aliasForUser(u);
    const st = document.createElement('div');
    st.className = 'muted';
    const base = u.online ? 'online' : `last seen: ${u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleString() : 'unknown'}`;
    st.textContent = `${base} • @${u.handle || u.username}`;
    info.append(name, st);
    left.append(info);

    const action = document.createElement('button');
    action.className = 'secondary';
    const blockedForDirect = Boolean(u.isSupport);
    action.textContent = blockedForDirect ? 'Только через чат поддержки' : 'Написать';
    action.disabled = blockedForDirect;
    if (!blockedForDirect) {
      action.addEventListener('click', () => openDirectWithUser(u).catch((e) => setChatMessage(e.message, true)));
    }

    const aliasBtn = document.createElement('button');
    aliasBtn.className = 'ghost';
    aliasBtn.textContent = 'Имя контакта';
    aliasBtn.type = 'button';
    aliasBtn.addEventListener('click', () => setAliasForUser(u));

    el.append(left, action, aliasBtn);
    userSearchResults.appendChild(el);
  });
}

function renderSelectedGroupMembers() {
  selectedGroupMembers.innerHTML = '';
  const users = allUsersCache.filter((u) => selectedGroupMemberIds.has(u.id));
  if (!users.length) {
    const hint = document.createElement('div');
    hint.className = 'muted';
    hint.textContent = 'Можно добавить только людей из контактов и только после их согласия.';
    groupMemberCandidates.appendChild(hint);
    return;
  }

  users.forEach((u) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = aliasForUser(u);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '×';
    remove.addEventListener('click', () => {
      selectedGroupMemberIds.delete(u.id);
      renderSelectedGroupMembers();
      renderGroupCandidates();
    });

    chip.appendChild(remove);
    selectedGroupMembers.appendChild(chip);
  });
}

function renderGroupCandidates() {
  const q = groupMemberSearchInput.value.trim().toLowerCase();
  groupMemberCandidates.innerHTML = '';

  if (q.length < 2) {
    const hint = document.createElement('div');
    hint.className = 'muted';
    hint.textContent = 'Введите минимум 2 символа для поиска участников';
    groupMemberCandidates.appendChild(hint);
    return;
  }

  const users = contactsCache
    .filter((u) => !selectedGroupMemberIds.has(u.id))
    .filter((u) => (u.username || '').toLowerCase().includes(q) || (u.handle || '').toLowerCase().includes(q))
    .slice(0, 10);

  if (!users.length) {
    const hint = document.createElement('div');
    hint.className = 'muted';
    hint.textContent = 'Можно добавить только людей из контактов и только после их согласия.';
    groupMemberCandidates.appendChild(hint);
    return;
  }

  users.forEach((u) => {
    const el = document.createElement('div');
    el.className = 'search-item';

    const name = document.createElement('span');
    name.textContent = aliasForUser(u);

    const add = document.createElement('button');
    add.type = 'button';
    add.textContent = 'Добавить';
    add.addEventListener('click', () => {
      selectedGroupMemberIds.add(u.id);
      renderSelectedGroupMembers();
      renderGroupCandidates();
    });

    el.append(name, add);
    groupMemberCandidates.appendChild(el);
  });
}

async function refreshUsersCache() {
  const data = await api('/api/users/search?mode=contains&q=*');
  allUsersCache = data.users || [];
}

async function refreshContactsCache() {
  const data = await api('/api/contacts');
  contactsCache = data.contacts || [];
}

function renderGroupInvites(invites) {
  if (!groupInvitesBox) return;
  groupInvitesBox.innerHTML = '';

  if (!invites || !invites.length) {
    groupInvitesBox.classList.add('hidden');
    return;
  }

  const title = document.createElement('div');
  title.className = 'muted';
  title.textContent = 'Вас пригласили в группы:';
  groupInvitesBox.appendChild(title);

  invites.forEach((invite) => {
    const row = document.createElement('div');
    row.className = 'search-item';

    const info = document.createElement('div');
    const ttl = document.createElement('strong');
    ttl.textContent = invite.conversationTitle;
    const by = document.createElement('div');
    by.className = 'muted';
    by.textContent = `Пригласил: ${invite.inviter}`;
    info.append(ttl, by);

    const actions = document.createElement('div');
    actions.className = 'row';
    const acceptBtn = document.createElement('button');
    acceptBtn.type = 'button';
    acceptBtn.textContent = 'Принять';
    acceptBtn.addEventListener('click', async () => {
      await api(`/api/group-invites/${invite.id}/respond`, {
        method: 'POST',
        body: JSON.stringify({ accept: true })
      });
      await loadConversations();
      await loadGroupInvites();
      setChatMessage('Приглашение принято');
    });

    const rejectBtn = document.createElement('button');
    rejectBtn.type = 'button';
    rejectBtn.className = 'ghost';
    rejectBtn.textContent = 'Отклонить';
    rejectBtn.addEventListener('click', async () => {
      await api(`/api/group-invites/${invite.id}/respond`, {
        method: 'POST',
        body: JSON.stringify({ accept: false })
      });
      await loadGroupInvites();
      setChatMessage('Приглашение отклонено');
    });

    actions.append(acceptBtn, rejectBtn);
    row.append(info, actions);
    groupInvitesBox.appendChild(row);
  });

  groupInvitesBox.classList.remove('hidden');
}

async function loadGroupInvites() {
  const data = await api('/api/group-invites');
  renderGroupInvites(data.invites || []);
}

async function searchUsers() {
  const q = userSearchInput.value.trim();
  if (!q) {
    renderSearchResults([]);
    return;
  }
  const data = await api(`/api/users/search?q=${encodeURIComponent(q)}`);
  renderSearchResults(data.users || []);
}

function openGroupModal(mode) {
  groupModalMode = mode;
  groupModalTitle.textContent = mode === 'create' ? 'Создать группу' : 'Настройки группы';

  if (mode === 'edit' && activeConversation?.type === 'group') {
    groupTitleInput.value = activeConversation.title;
    selectedGroupMemberIds = new Set(activeConversation.participantIds.filter((id) => id !== currentUser.id));
  } else {
    groupTitleInput.value = '';
    selectedGroupMemberIds = new Set();
  }

  groupMemberSearchInput.value = '';
  renderSelectedGroupMembers();
  renderGroupCandidates();
  groupModal.classList.remove('hidden');
}

function closeGroupModal() {
  groupModal.classList.add('hidden');
}

async function saveGroupFromModal() {
  const title = groupTitleInput.value.trim();
  const memberIds = Array.from(selectedGroupMemberIds);

  if (groupModalMode === 'create') {
    const data = await api('/api/conversations/group', {
      method: 'POST',
      body: JSON.stringify({ title, memberIds })
    });
    await loadConversations();
    await openConversation(data.conversation.id);
    if ((data.invites || 0) > 0) setChatMessage(`Отправлено приглашений: ${data.invites}`);
    closeGroupModal();
    return;
  }

  if (!activeConversation || activeConversation.type !== 'group') return;

  await api(`/api/conversations/${activeConversation.id}/rename`, {
    method: 'POST',
    body: JSON.stringify({ title })
  });

  const existing = new Set(activeConversation.participantIds.filter((id) => id !== currentUser.id));
  const toAdd = memberIds.filter((id) => !existing.has(id));
  const toRemove = [...existing].filter((id) => !memberIds.includes(id));

  if (toAdd.length) {
    const addResult = await api(`/api/conversations/${activeConversation.id}/members/add`, {
      method: 'POST',
      body: JSON.stringify({ memberIds: toAdd })
    });
    if ((addResult.invites || 0) > 0) setChatMessage(`Отправлено приглашений: ${addResult.invites}`);
  }

  for (const mid of toRemove) {
    await api(`/api/conversations/${activeConversation.id}/members/remove`, {
      method: 'POST',
      body: JSON.stringify({ memberId: mid })
    });
  }

  await loadConversations();
  await openConversation(activeConversation.id);
  closeGroupModal();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function imageFileToJpegDataUrl(file, maxSide = 1920, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const width = Math.max(1, Math.round(img.naturalWidth * ratio));
      const height = Math.max(1, Math.round(img.naturalHeight * ratio));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas is not supported'));
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Не удалось обработать изображение'));

    const reader = new FileReader();
    reader.onload = () => {
      img.src = String(reader.result || '');
    };
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });
}

async function fileToAttachmentDataUrl(file) {
  const isImage = (file.type || '').startsWith('image/');
  if (!isImage) return fileToDataUrl(file);

  if (file.size > 3 * 1024 * 1024 || /heic|heif/i.test(file.type || '')) {
    return imageFileToJpegDataUrl(file);
  }
  return fileToDataUrl(file);
}

function updateMediaPreview() {
  mediaPreview.innerHTML = '';
  const file = mediaInput.files[0];
  if (!file) {
    mediaPreview.classList.add('hidden');
    return;
  }

  const type = file.type || '';
  const url = URL.createObjectURL(file);

  if (type.startsWith('image/')) {
    const img = document.createElement('img');
    img.src = url;
    mediaPreview.appendChild(img);
  } else if (type.startsWith('video/')) {
    const video = document.createElement('video');
    video.src = url;
    video.controls = true;
    mediaPreview.appendChild(video);
  }

  const meta = document.createElement('p');
  meta.className = 'muted';
  meta.textContent = `${file.name} • ${(file.size / 1024 / 1024).toFixed(2)} MB`;
  mediaPreview.appendChild(meta);
  mediaPreview.classList.remove('hidden');
}

async function sendSupportComplaint(category) {
  if (!activeConversation || activeConversation.type !== 'support') return;
  await api(`/api/conversations/${activeConversation.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ text: `Жалоба: ${category}`, complaintType: category })
  });
}

async function sendMessage() {
  if (!activeConversation) return setChatMessage('Сначала выберите чат', true);
  if (isSendingMessage) return;

  isSendingMessage = true;
  const submitButton = messageForm.querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = true;

  try {
    const text = messageInput.value.trim();
    const file = mediaInput.files[0];

    let attachment = null;
    if (file) {
      const dataUrl = await fileToAttachmentDataUrl(file);
      attachment = { dataUrl };
    }

    const clientMessageId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const data = await api(`/api/conversations/${activeConversation.id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text, attachment, clientMessageId })
    });

    if (data?.message && activeConversation?.id === data.message.conversationId) {
      appendMessage(data.message);
    }

    await loadConversations();

    messageInput.value = '';
    mediaInput.value = '';
    mediaPreview.classList.add('hidden');
    mediaPreview.innerHTML = '';
  } finally {
    isSendingMessage = false;
    if (submitButton) submitButton.disabled = false;
  }
}



function setPushStatus(text, isError = false) {
  if (!pushStatus) return;
  pushStatus.textContent = text;
  pushStatus.style.color = isError ? '#b91c1c' : '#6b7280';
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function refreshPushUi() {
  if (!togglePushBtn) return;

  const hasNotificationApi = 'Notification' in window;
  const hasServiceWorker = 'serviceWorker' in navigator;
  const hasPushManager = 'PushManager' in window;
  const isSecure = window.isSecureContext;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  const missing = [];
  if (!isSecure) missing.push('нужен HTTPS (или localhost)');
  if (!hasNotificationApi) missing.push('Notification API отсутствует');
  if (!hasServiceWorker) missing.push('Service Worker недоступен');
  if (!hasPushManager) missing.push('Push API недоступен (iOS 16.4+ и PWA)');

  if (missing.length) {
    togglePushBtn.disabled = true;
    togglePushBtn.textContent = 'Включить push-уведомления';
    setPushStatus(`Push пока недоступен: ${missing.join(', ')}`);
    return;
  }

  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = registration ? await registration.pushManager.getSubscription() : null;

  togglePushBtn.disabled = false;
  togglePushBtn.textContent = subscription ? 'Выключить push-уведомления' : 'Включить push-уведомления';

  if (!isStandalone) {
    setPushStatus('Откройте именно ярлык с экрана Домой (PWA), затем включите push.');
  } else if (subscription) {
    setPushStatus('Push-уведомления включены.');
  } else {
    setPushStatus('Push-уведомления выключены. Нажмите кнопку, чтобы включить.');
  }
}

async function togglePushNotifications() {
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();

  if (existing) {
    await api('/api/push/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ endpoint: existing.endpoint })
    });
    await existing.unsubscribe();
    await refreshPushUi();
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    setPushStatus('Разрешите уведомления в настройках браузера.', true);
    return;
  }

  const keyData = await api('/api/push/public-key');
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(keyData.publicKey)
  });

  await api('/api/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({ subscription })
  });
  await refreshPushUi();
}

async function syncPushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (!window.isSecureContext) return;

  const permission = 'Notification' in window ? Notification.permission : 'default';
  if (permission !== 'granted') return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    if (!existing) return;

    await api('/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ subscription: existing })
    });
  } catch {
    // Best-effort sync to reduce lost push after endpoint rotation.
  }
}

function renderSupportAgents(agents) {
  if (!supportAgentsList) return;
  supportAgentsList.innerHTML = '';
  (agents || []).forEach((agent) => {
    const item = document.createElement('div');
    item.className = 'search-item';

    const name = document.createElement('span');
    name.textContent = `${agent.username} (${agent.role === 'support_admin' ? 'admin' : 'agent'})`;

    const status = document.createElement('span');
    status.className = 'muted';
    status.textContent = agent.online ? 'online' : 'offline';

    item.append(name, status);
    supportAgentsList.appendChild(item);
  });
}

async function openSettingsModal() {
  const profile = await api('/api/profile');
  hideNameCheckbox.checked = Boolean(profile.hideName);
  showOnlineStatusCheckbox.checked = Boolean(profile.showOnlineStatus);
  allowAvatarViewCheckbox.checked = Boolean(profile.allowAvatarView);
  allowAvatarDownloadCheckbox.checked = Boolean(profile.allowAvatarDownload);
  selectedAvatarDataUrl = undefined;

  avatarPreview.innerHTML = '';
  if (profile.avatar) {
    const img = document.createElement('img');
    img.src = profile.avatar;
    avatarPreview.appendChild(img);
    avatarPreview.classList.remove('hidden');
  } else {
    avatarPreview.classList.add('hidden');
  }

  const isAdmin = profile.role === 'support_admin';
  supportAdminPanel.classList.toggle('hidden', !isAdmin);
  if (isAdmin) {
    const { agents } = await api('/api/support/agents');
    renderSupportAgents(agents || []);
  }

  themeSelect.value = localStorage.getItem('messenger_theme') || 'light';
  compactModeCheckbox.checked = localStorage.getItem('messenger_compact_ui') === '1';

  settingsModal.classList.remove('hidden');
  await refreshPushUi();
}

function closeSettingsModal() {
  settingsModal.classList.add('hidden');
}

async function saveSettings() {
  const payload = {
    hideName: hideNameCheckbox.checked,
    showOnlineStatus: showOnlineStatusCheckbox.checked,
    allowAvatarView: allowAvatarViewCheckbox.checked,
    allowAvatarDownload: allowAvatarDownloadCheckbox.checked
  };
  if (selectedAvatarDataUrl !== undefined) payload.avatarDataUrl = selectedAvatarDataUrl;

  const data = await api('/api/profile', { method: 'POST', body: JSON.stringify(payload) });

  const nextTheme = themeSelect?.value || 'light';
  const compactUi = Boolean(compactModeCheckbox?.checked);
  localStorage.setItem('messenger_theme', nextTheme);
  localStorage.setItem('messenger_compact_ui', compactUi ? '1' : '0');
  applyTheme(nextTheme);
  applyCompactMode(compactUi);

  currentUser = data.user;
  meLabel.textContent = `@${currentUser.username}`;

  await Promise.all([refreshUsersCache(), searchUsers(), loadConversations()]);
  closeSettingsModal();
}

function resetUI() {
  currentUser = null;
  token = '';
  conversations = [];
  activeConversation = null;
  allUsersCache = [];
  selectedGroupMemberIds = new Set();
  localStorage.removeItem('messenger_token');
  clearRealtime();
  authPanel.classList.remove('hidden');
  chatPanel.classList.add('hidden');
  showAuthPage('login');
  setPushStatus('');
}

async function ensureRequiredRecoveryData() {
  if (!currentUser) return;
  const profile = await api('/api/profile');
  if (profile.role !== 'user') return;

  const missing = {
    fullName: !profile.fullName,
    email: !profile.email,
    securityQuestion: !profile.securityQuestion,
    securityAnswer: !profile.hasSecurityAnswer
  };
  if (!missing.fullName && !missing.email && !missing.securityQuestion && !missing.securityAnswer) return;

  requiredFullNameInput.value = profile.fullName || '';
  requiredEmailInput.value = profile.email || '';
  requiredSecurityQuestionInput.value = profile.securityQuestion || '';
  requiredSecurityAnswerInput.value = '';

  requiredFullNameInput.classList.toggle('hidden', !missing.fullName);
  requiredEmailInput.classList.toggle('hidden', !missing.email);
  requiredSecurityQuestionInput.classList.toggle('hidden', !missing.securityQuestion);
  requiredSecurityAnswerInput.classList.toggle('hidden', !missing.securityAnswer);

  requiredProfileModal?.classList.remove('hidden');

  if (!requiredProfilePromise) {
    requiredProfilePromise = new Promise((resolve) => {
      const handler = async () => {
        try {
          const payload = {};
          if (missing.fullName) payload.fullName = requiredFullNameInput.value.trim();
          if (missing.email) payload.email = requiredEmailInput.value.trim();
          if (missing.securityQuestion) payload.securityQuestion = requiredSecurityQuestionInput.value.trim();
          if (missing.securityAnswer) payload.securityAnswer = requiredSecurityAnswerInput.value.trim();

          if (missing.fullName && !payload.fullName) return setAuthMessage('Введите имя', true);
          if (missing.email && !payload.email) return setAuthMessage('Введите email', true);
          if (missing.securityQuestion && !payload.securityQuestion)
            return setAuthMessage('Введите контрольный вопрос', true);
          if (missing.securityAnswer && !payload.securityAnswer)
            return setAuthMessage('Введите контрольный ответ', true);

          await api('/api/profile', { method: 'POST', body: JSON.stringify(payload) });
          requiredProfileModal?.classList.add('hidden');
          setAuthMessage('Данные аккаунта обновлены. Доступ к сообщениям открыт.');
          saveRequiredProfileBtn?.removeEventListener('click', handler);
          requiredProfilePromise = null;
          resolve();
        } catch (error) {
          setAuthMessage(error.message, true);
        }
      };
      saveRequiredProfileBtn?.addEventListener('click', handler);
    });
  }

  await requiredProfilePromise;
}

async function enterApp(user) {
  currentUser = user;
  meLabel.textContent = `@${user.username}`;
  authPanel.classList.add('hidden');
  chatPanel.classList.remove('hidden');

  const supportData = await api('/api/support/categories');
  supportCategories = supportData.categories || [];

  await ensureRequiredRecoveryData();
  await Promise.all([loadConversations(), refreshUsersCache(), searchUsers()]);
  await syncPushSubscription();
  setSidebarTab('chats');
  renderGroupCandidates();

  if (conversations[0]) await openConversation(conversations[0].id);
  else setMobileDialogMode(false);
  await connectRealtime();
  startConversationSync();
}

function showAuthPage(name) {
  loginPage?.classList.toggle('hidden', name !== 'login');
  registerPage?.classList.toggle('hidden', name !== 'register');
  recoveryPage?.classList.toggle('hidden', name !== 'recovery');
}

async function doLogin() {
  const username = loginUsernameInput.value.trim();
  const password = loginPasswordInput.value;
  if (!username || !password) return setAuthMessage('Введите логин и пароль', true);

  try {
    setAuthMessage('Загрузка...');
    const login = await api('/api/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    token = login.token;
    localStorage.setItem('messenger_token', token);
    setAuthMessage('');
    await enterApp(login.user);
    await forceAppUpdateCheck();
  } catch (error) {
    setAuthMessage(error.message, true);
  }
}

async function doRegister() {
  const username = registerUsernameInput.value.trim();
  const password = registerPasswordInput.value;
  if (!username || !password) return setAuthMessage('Введите username и password для регистрации', true);

  try {
    setAuthMessage('Создание аккаунта...');
    await api('/api/register', {
      method: 'POST',
      body: JSON.stringify({
        username,
        password,
        fullName: registerFullNameInput?.value?.trim() || '',
        email: registerEmailInput?.value?.trim() || '',
        securityQuestion: registerSecurityQuestionInput?.value?.trim() || '',
        securityAnswer: registerSecurityAnswerInput?.value?.trim() || ''
      })
    });

    loginUsernameInput.value = username;
    loginPasswordInput.value = password;
    showAuthPage('login');
    setAuthMessage('Аккаунт создан. Теперь войдите.', false);
    await forceAppUpdateCheck();
  } catch (error) {
    setAuthMessage(error.message, true);
  }
}

async function restoreSession() {
  if (!token) return;
  try {
    const { user } = await api('/api/me');
    await enterApp(user);
  } catch {
    resetUI();
  }
}

loginBtn.addEventListener('click', () => doLogin());
registerBtn.addEventListener('click', () => doRegister());
showLoginPageBtn?.addEventListener('click', () => showAuthPage('login'));
showRegisterPageBtn?.addEventListener('click', () => showAuthPage('register'));
showRecoveryPageBtn?.addEventListener('click', () => showAuthPage('recovery'));
goRegisterFromLoginBtn?.addEventListener('click', () => showAuthPage('register'));
goLoginFromRegisterBtn?.addEventListener('click', () => showAuthPage('login'));

forgotPasswordBtn?.addEventListener('click', async () => {
  try {
    const username = recoverUsernameInput.value.trim();
    if (!username) return setAuthMessage('Введите username для восстановления', true);
    const data = await api('/api/password/forgot', {
      method: 'POST',
      body: JSON.stringify({
        username,
        email: recoverEmailInput?.value?.trim() || '',
        securityAnswer: recoverSecurityAnswerInput?.value?.trim() || ''
      })
    });
    setAuthMessage(data.delivery || 'Запрос выполнен');
    await forceAppUpdateCheck();
  } catch (error) {
    setAuthMessage(error.message, true);
  }
});

guestSupportBtn?.addEventListener('click', async () => {
  try {
    const username = recoverUsernameInput?.value?.trim() || '';
    const topic = username ? 'Забыл пароль' : 'Другое';
    const text = guestSupportTextInput?.value?.trim() || '';
    if (!text) return setAuthMessage('Введите текст обращения для поддержки', true);
    const data = await api('/api/support/guest', {
      method: 'POST',
      body: JSON.stringify({
        topic,
        username,
        email: recoverEmailInput?.value?.trim() || '',
        text
      })
    });
    setAuthMessage(data.message || 'Обращение отправлено');
    await forceAppUpdateCheck();
  } catch (error) {
    setAuthMessage(error.message, true);
  }
});
logoutBtn.addEventListener('click', async () => {
  try {
    await api('/api/logout', { method: 'POST' });
  } catch {
    // ignore
  }
  resetUI();
});

logoutBtnTab?.addEventListener('click', async () => {
  try {
    await api('/api/logout', { method: 'POST' });
  } catch {
    // ignore
  }
  resetUI();
});

openSettingsBtn.addEventListener('click', () => {
  openSettingsModal().catch((e) => setChatMessage(e.message, true));
});

openSettingsBtnTab?.addEventListener('click', () => {
  openSettingsModal().catch((e) => setChatMessage(e.message, true));
});

avatarInput.addEventListener('change', async () => {
  const file = avatarInput.files[0];
  if (!file) {
    selectedAvatarDataUrl = null;
    return;
  }
  selectedAvatarDataUrl = await fileToDataUrl(file);
  avatarPreview.innerHTML = '';
  const img = document.createElement('img');
  img.src = selectedAvatarDataUrl;
  avatarPreview.appendChild(img);
  avatarPreview.classList.remove('hidden');
});

saveSettingsBtn.addEventListener('click', () => saveSettings().catch((e) => setChatMessage(e.message, true)));
cancelSettingsBtn.addEventListener('click', closeSettingsModal);
togglePushBtn?.addEventListener('click', () => togglePushNotifications().catch((e) => setPushStatus(e.message, true)));
settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) closeSettingsModal();
});

createSupportAgentBtn?.addEventListener('click', async () => {
  try {
    await api('/api/support/agents', {
      method: 'POST',
      body: JSON.stringify({ username: supportAgentUsername.value.trim(), password: supportAgentPassword.value })
    });
    supportAgentUsername.value = '';
    supportAgentPassword.value = '';
    const { agents } = await api('/api/support/agents');
    renderSupportAgents(agents || []);
    setChatMessage('Аккаунт поддержки создан');
  } catch (e) {
    setChatMessage(e.message, true);
  }
});

conversationSearchInput.addEventListener('input', renderConversationList);
userSearchInput.addEventListener('input', () => searchUsers().catch((e) => setChatMessage(e.message, true)));

openCreateGroupBtn.addEventListener('click', () => openGroupModal('create'));
openGroupSettingsBtn.addEventListener('click', () => openGroupModal('edit'));
groupMemberSearchInput.addEventListener('input', renderGroupCandidates);
saveGroupBtn.addEventListener('click', () => saveGroupFromModal().catch((e) => setChatMessage(e.message, true)));
cancelGroupBtn.addEventListener('click', closeGroupModal);
saveContactAliasBtn?.addEventListener('click', async () => {
  let directUserId = null;
  if (pendingAliasUser) {
    persistAlias(pendingAliasUser, contactAliasInput.value || '');
    directUserId = pendingDirectUserId;
  }
  closeAliasModal();

  if (directUserId) {
    try {
      const data = await api('/api/conversations/direct', {
        method: 'POST',
        body: JSON.stringify({ targetUserId: directUserId })
      });
      await loadConversations();
      await openConversation(data.conversation.id);
    } catch (e) {
      setChatMessage(e.message, true);
    }
  }
});
cancelContactAliasBtn?.addEventListener('click', closeAliasModal);
groupModal.addEventListener('click', (e) => {
  if (e.target === groupModal) closeGroupModal();
});
contactAliasModal?.addEventListener('click', (e) => {
  if (e.target === contactAliasModal) closeAliasModal();
});
closeMediaViewerBtn?.addEventListener('click', closeMediaViewer);
mediaViewerModal?.addEventListener('click', (e) => {
  if (e.target === mediaViewerModal) closeMediaViewer();
});

supportChatBtn.addEventListener('click', async () => {
  try {
    const data = await api('/api/conversations/support', { method: 'POST' });
    await loadConversations();
    await openConversation(data.conversation.id);
  } catch (e) {
    setChatMessage(e.message, true);
  }
});

supportChatBtnTab?.addEventListener('click', async () => {
  try {
    const data = await api('/api/conversations/support', { method: 'POST' });
    setSidebarTab('chats');
    await loadConversations();
    await openConversation(data.conversation.id);
  } catch (e) {
    setChatMessage(e.message, true);
  }
});

tabChatsBtn?.addEventListener('click', () => {
  setSidebarTab('chats');
  if (isMobileLayout()) setMobileDialogMode(false);
});
tabContactsBtn?.addEventListener('click', () => setSidebarTab('contacts'));
tabSettingsBtn?.addEventListener('click', () => setSidebarTab('settings'));
backToListBtn?.addEventListener('click', () => setMobileDialogMode(false));
themeSelect?.addEventListener('change', () => applyTheme(themeSelect.value));
compactModeCheckbox?.addEventListener('change', () => applyCompactMode(compactModeCheckbox.checked));

loadOlderBtn.addEventListener('click', () => loadOlderMessages().catch((e) => setChatMessage(e.message, true)));
mediaInput.addEventListener('change', updateMediaPreview);
messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  sendMessage().catch((error) => setChatMessage(error.message, true));
});

window.addEventListener('beforeunload', clearRealtime);
window.addEventListener('resize', () => {
  if (!activeConversation) {
    setMobileDialogMode(false);
    return;
  }
  setMobileDialogMode(chatPanel.classList.contains('dialog-only'));
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    forceAppUpdateCheck().catch(() => {});
    syncPushSubscription().catch(() => {});
    if (token && !streamAbortController) connectRealtime().catch(() => {});
    if (token) syncActiveConversationMessages().catch(() => {});
  }
});

window.addEventListener('online', () => {
  forceAppUpdateCheck().catch(() => {});
  if (!token) return;
  if (!streamAbortController) connectRealtime().catch(() => {});
  syncActiveConversationMessages().catch(() => {});
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            window.location.reload();
          }
        });
      });

      setInterval(() => registration.update().catch(() => {}), 60 * 1000);
    } catch {
      // ignore sw registration errors
    }
  });
}

initUiSettings();
setMobileDialogMode(false);
showAuthPage('login');
forceAppUpdateCheck().catch(() => {});
restoreSession().catch(() => {});

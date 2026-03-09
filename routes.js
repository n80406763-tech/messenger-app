const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');

const DEFAULT_DATA_DIR = '/var/data/netrender';
const LEGACY_DB_FILE = 'messenger.json';

function resolveDataDirs() {
  const preferred = process.env.DATA_DIR || DEFAULT_DATA_DIR;
  try {
    fs.mkdirSync(preferred, { recursive: true });
    fs.mkdirSync(path.join(preferred, 'db'), { recursive: true });
    fs.mkdirSync(path.join(preferred, 'uploads'), { recursive: true });
    return {
      DATA_DIR: preferred,
      DB_DIR: path.join(preferred, 'db'),
      UPLOADS_DIR: path.join(preferred, 'uploads')
    };
  } catch {
    const fallback = path.join(__dirname, 'data');
    fs.mkdirSync(fallback, { recursive: true });
    fs.mkdirSync(path.join(fallback, 'db'), { recursive: true });
    fs.mkdirSync(path.join(fallback, 'uploads'), { recursive: true });
    return {
      DATA_DIR: fallback,
      DB_DIR: path.join(fallback, 'db'),
      UPLOADS_DIR: path.join(fallback, 'uploads')
    };
  }
}

const { DATA_DIR, DB_DIR, UPLOADS_DIR } = resolveDataDirs();
const USERS_FILE = path.join(DB_DIR, 'users.json');
const MESSAGES_FILE = path.join(DB_DIR, 'messages.json');
const CONVERSATIONS_FILE = path.join(DB_DIR, 'conversations.json');
const META_FILE = path.join(DB_DIR, 'meta.json');
const LEGACY_DB_PATH = path.join(DATA_DIR, LEGACY_DB_FILE);
const LOCAL_LEGACY_DB_PATH = path.join(__dirname, LEGACY_DB_FILE);

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const LOGIN_WINDOW_MS = 1000 * 60 * 5;
const LOGIN_LIMIT = 30;
const MESSAGE_WINDOW_MS = 1000 * 60;
const MESSAGE_LIMIT = 90;
const DEFAULT_MESSAGES_LIMIT = 40;
const MAX_MESSAGES_LIMIT = 100;
const MAX_ATTACHMENT_BYTES = 12 * 1024 * 1024;
const MAX_BODY_BYTES = 16 * 1024 * 1024;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const SUPPORT_TITLE = 'Чат поддержки';
const SUPPORT_CATEGORIES = [
  'Проблема с аккаунтом',
  'Жалоба на пользователя',
  'Проблема с медиа',
  'Ошибка приложения',
  'Забыл пароль',
  'Другое'
];

const DEFAULT_SUPPORT_ADMIN = {
  username: process.env.SUPPORT_ADMIN_USERNAME || 'support',
  password: process.env.SUPPORT_ADMIN_PASSWORD || 'support123'
};

const DEFAULT_SUPPORT_AGENT = {
  username: process.env.SUPPORT_AGENT_USERNAME || 'helper',
  password: process.env.SUPPORT_AGENT_PASSWORD || 'helper123'
};


const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY || 'BNmvLaETpuVL-5ZT46qFp3yy9nfMHoPdaHdjhs78493VV6q6tQnxg4Njl5F_zUot3gOz_bb_p0s87n_4taGUrWI';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'sZ5jXVgmbWlg1QwxSSjwN6qn8Ooy-uZkIwq17CauPc8';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

function getIceServersFromEnv() {
  const servers = [];

  const stun = String(process.env.WEBRTC_STUN_URL || 'stun:stun.l.google.com:19302').trim();
  if (stun) servers.push({ urls: [stun] });

  const turnUrl = String(process.env.WEBRTC_TURN_URL || '').trim();
  const turnUsername = String(process.env.WEBRTC_TURN_USERNAME || '').trim();
  const turnCredential = String(process.env.WEBRTC_TURN_CREDENTIAL || '').trim();

  if (turnUrl) {
    const turnServer = { urls: [turnUrl] };
    if (turnUsername) turnServer.username = turnUsername;
    if (turnCredential) turnServer.credential = turnCredential;
    servers.push(turnServer);
  }

  return servers;
}

const sessions = new Map();
const sseClients = new Map();
const ipLoginRequests = new Map();
const userMessageRequests = new Map();

function createInitialState() {
  return {
    users: [],
    conversations: [],
    messages: [],
    pushInbox: {},
    recentClientMessages: {},
    mailOutbox: [],
    persistedSessions: {},
    groupInvites: [],
    nextInviteId: 1,
    nextUserId: 1,
    nextConversationId: 1,
    nextMessageId: 1
  };
}

function normalizeLoadedState(parsed) {
  return {
    users: parsed.users || [],
    conversations: parsed.conversations || [],
    messages: parsed.messages || [],
    pushInbox: parsed.pushInbox && typeof parsed.pushInbox === 'object' ? parsed.pushInbox : {},
    recentClientMessages:
      parsed.recentClientMessages && typeof parsed.recentClientMessages === 'object' ? parsed.recentClientMessages : {},
    mailOutbox: Array.isArray(parsed.mailOutbox) ? parsed.mailOutbox : [],
    persistedSessions:
      parsed.persistedSessions && typeof parsed.persistedSessions === 'object' ? parsed.persistedSessions : {},
    groupInvites: Array.isArray(parsed.groupInvites) ? parsed.groupInvites : [],
    nextInviteId: parsed.nextInviteId || 1,
    nextUserId: parsed.nextUserId || 1,
    nextConversationId: parsed.nextConversationId || 1,
    nextMessageId: parsed.nextMessageId || 1
  };
}

function loadLegacyStateFrom(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const normalized = normalizeLoadedState(parsed);
    saveState(normalized);
    fs.renameSync(filePath, `${filePath}.migrated-${Date.now()}`);
    return normalized;
  } catch {
    return null;
  }
}

function loadState() {
  const usersExists = fs.existsSync(USERS_FILE);
  const messagesExists = fs.existsSync(MESSAGES_FILE);
  const conversationsExists = fs.existsSync(CONVERSATIONS_FILE);
  const metaExists = fs.existsSync(META_FILE);

  if (usersExists && messagesExists && conversationsExists && metaExists) {
    try {
      return normalizeLoadedState({
        users: JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')),
        messages: JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8')),
        conversations: JSON.parse(fs.readFileSync(CONVERSATIONS_FILE, 'utf8')),
        ...JSON.parse(fs.readFileSync(META_FILE, 'utf8'))
      });
    } catch {
      return createInitialState();
    }
  }

  if (fs.existsSync(LEGACY_DB_PATH)) {
    const migrated = loadLegacyStateFrom(LEGACY_DB_PATH);
    if (migrated) return migrated;
  }

  if (fs.existsSync(LOCAL_LEGACY_DB_PATH)) {
    const migrated = loadLegacyStateFrom(LOCAL_LEGACY_DB_PATH);
    if (migrated) return migrated;
  }

  return createInitialState();
}

let state = loadState();

function bootstrapSessionsFromState() {
  const entries = Object.entries(state.persistedSessions || {});
  for (const [token, session] of entries) {
    if (!session || typeof session.userId !== 'number' || typeof session.touchedAt !== 'number') continue;
    sessions.set(token, { userId: session.userId, touchedAt: session.touchedAt });
  }
}

bootstrapSessionsFromState();

function normalizeLegacyUsers() {
  state.users = state.users.map((u) => ({
    ...u,
    role: u.role || 'user',
    avatar: u.avatar || null,
    hideName: Boolean(u.hideName),
    lastSeenAt: u.lastSeenAt || null,
    showOnlineStatus: u.showOnlineStatus !== false,
    allowAvatarView: u.allowAvatarView !== false,
    allowAvatarDownload: Boolean(u.allowAvatarDownload),
    pushSubscriptions: Array.isArray(u.pushSubscriptions) ? u.pushSubscriptions : [],
    fullName: normalizeText(u.fullName || ''),
    email: normalizeText(u.email || '').toLowerCase(),
    securityQuestion: normalizeText(u.securityQuestion || ''),
    securityAnswerHash: u.securityAnswerHash || null
  }));
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function randomPassword(length = 10) {
  return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

function maskEmail(email) {
  const source = String(email || '').trim();
  const [name, domain] = source.split('@');
  if (!name || !domain) return '';
  if (name.length <= 2) return `${name[0] || '*'}***@${domain}`;
  return `${name.slice(0, 2)}***@${domain}`;
}

function queueEmail(to, subject, text) {
  const letter = {
    id: `${Date.now()}_${Math.random().toString(16).slice(2, 10)}`,
    to,
    subject,
    text,
    createdAt: new Date().toISOString()
  };
  state.mailOutbox.push(letter);
  if (state.mailOutbox.length > 300) state.mailOutbox = state.mailOutbox.slice(-300);
  console.log('[MAIL MOCK]', JSON.stringify(letter));
}

function applyPasswordReset(user, reason) {
  const newPassword = randomPassword(12);
  user.passwordHash = hashPassword(newPassword);
  user.lastSeenAt = new Date().toISOString();

  if (user.email) {
    queueEmail(
      user.email,
      'Messenger: новый пароль',
      `Здравствуйте, @${user.username}. Причина: ${reason}. Ваш новый пароль: ${newPassword}`
    );
  }

  return { newPassword, hasEmail: Boolean(user.email) };
}

function ensureSupportAdmin() {
  const exists = state.users.find((u) => u.role === 'support_admin');
  if (exists) return;

  const supportAdmin = {
    id: state.nextUserId++,
    username: DEFAULT_SUPPORT_ADMIN.username,
    passwordHash: hashPassword(DEFAULT_SUPPORT_ADMIN.password),
    role: 'support_admin',
    avatar: null,
    hideName: false,
    lastSeenAt: null,
    showOnlineStatus: true,
    allowAvatarView: true,
    allowAvatarDownload: false,
    fullName: '',
    email: '',
    securityQuestion: '',
    securityAnswerHash: null
  };
  state.users.push(supportAdmin);
  saveState();
}


function ensureDefaultSupportAgent() {
  const exists = state.users.find((u) => u.role === 'support_agent');
  if (exists) return;

  const supportAgent = {
    id: state.nextUserId++,
    username: DEFAULT_SUPPORT_AGENT.username,
    passwordHash: hashPassword(DEFAULT_SUPPORT_AGENT.password),
    role: 'support_agent',
    avatar: null,
    hideName: false,
    lastSeenAt: null,
    showOnlineStatus: true,
    allowAvatarView: true,
    allowAvatarDownload: false,
    fullName: '',
    email: '',
    securityQuestion: '',
    securityAnswerHash: null
  };
  state.users.push(supportAgent);
  saveState();
}


function base64UrlToBuffer(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 ? '='.repeat(4 - (normalized.length % 4)) : '';
  return Buffer.from(normalized + padding, 'base64');
}

function vapidPrivateKeyObject() {
  const publicBytes = base64UrlToBuffer(VAPID_PUBLIC_KEY);
  if (publicBytes.length !== 65 || publicBytes[0] !== 4) throw new Error('Invalid VAPID public key');

  const x = publicBytes.subarray(1, 33).toString('base64url');
  const y = publicBytes.subarray(33, 65).toString('base64url');
  return crypto.createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      x,
      y,
      d: VAPID_PRIVATE_KEY
    },
    format: 'jwk'
  });
}

function createVapidJwt(audience) {
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      aud: audience,
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
      sub: VAPID_SUBJECT
    })
  ).toString('base64url');
  const input = `${header}.${payload}`;
  const signature = crypto.sign('sha256', Buffer.from(input), {
    key: vapidPrivateKeyObject(),
    dsaEncoding: 'ieee-p1363'
  });
  return `${input}.${signature.toString('base64url')}`;
}

function pushInboxKey(endpoint) {
  return `ep:${endpoint}`;
}

function queuePushPayload(endpoint, payload) {
  if (!endpoint || !payload) return;
  const key = pushInboxKey(endpoint);
  const list = Array.isArray(state.pushInbox[key]) ? state.pushInbox[key] : [];
  list.push(payload);
  if (list.length > 20) list.splice(0, list.length - 20);
  state.pushInbox[key] = list;
}

function pullPushPayload(endpoint) {
  const key = pushInboxKey(endpoint);
  const list = Array.isArray(state.pushInbox[key]) ? state.pushInbox[key] : [];
  if (!list.length) return null;
  const payload = list.shift();
  if (list.length) state.pushInbox[key] = list;
  else delete state.pushInbox[key];
  return payload;
}

function pullAllPushPayloads(endpoint, limit = 20) {
  const out = [];
  for (let i = 0; i < limit; i += 1) {
    const next = pullPushPayload(endpoint);
    if (!next) break;
    out.push(next);
  }
  return out;
}

function removePushInbox(endpoint) {
  if (!endpoint) return;
  delete state.pushInbox[pushInboxKey(endpoint)];
}

function hasSubscriptionEndpoint(endpoint) {
  return state.users.some((u) =>
    Array.isArray(u.pushSubscriptions) && u.pushSubscriptions.some((sub) => sub.endpoint === endpoint)
  );
}

function cleanupRecentClientMessages(nowTs = Date.now()) {
  const ttlMs = 1000 * 60 * 10;
  const maxEntries = 5000;
  const entries = Object.entries(state.recentClientMessages || {});

  for (const [key, item] of entries) {
    if (!item || nowTs - Number(item.createdAtMs || 0) > ttlMs) {
      delete state.recentClientMessages[key];
    }
  }

  const left = Object.entries(state.recentClientMessages || {});
  if (left.length <= maxEntries) return;

  left
    .sort((a, b) => Number(a[1].createdAtMs || 0) - Number(b[1].createdAtMs || 0))
    .slice(0, left.length - maxEntries)
    .forEach(([key]) => {
      delete state.recentClientMessages[key];
    });
}

function normalizeClientMessageId(value) {
  const id = String(value || '').trim();
  if (!id || id.length > 120) return '';
  return id;
}

function dedupeKey(userId, conversationId, clientMessageId) {
  return `${userId}:${conversationId}:${clientMessageId}`;
}

function sendWebPush(subscription) {
  return new Promise((resolve) => {
    try {
      const endpointUrl = new URL(subscription.endpoint);
      const jwt = createVapidJwt(endpointUrl.origin);
      const transport = endpointUrl.protocol === 'https:' ? https : http;
      const request = transport.request(
        {
          protocol: endpointUrl.protocol,
          hostname: endpointUrl.hostname,
          port: endpointUrl.port || (endpointUrl.protocol === 'https:' ? 443 : 80),
          path: `${endpointUrl.pathname}${endpointUrl.search}`,
          method: 'POST',
          headers: {
            TTL: '2419200',
            Urgency: 'high',
            Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
            'Content-Length': '0'
          }
        },
        (res) => {
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode || 0 });
          res.resume();
        }
      );
      request.on('error', () => resolve({ ok: false, status: 0 }));
      request.end();
    } catch {
      resolve({ ok: false, status: 0 });
    }
  });
}

function buildPushPayload(message, conversation, recipientId) {
  const serialized = serializeMessageForViewer(message, recipientId);
  const recipient = state.users.find((u) => u.id === recipientId);
  const title = serialized.sender || 'Messenger';
  const body = serialized.text || (serialized.attachment ? '📎 Медиа-сообщение' : 'Новое сообщение');
  const url = `/index.html?conversation=${conversation.id}`;

  return {
    title,
    body,
    conversationId: conversation.id,
    sender: serialized.sender,
    messageId: serialized.id,
    createdAt: serialized.createdAt,
    url,
    recipientId: recipient?.id || null
  };
}

async function sendPushToUser(user, payload) {
  if (!Array.isArray(user.pushSubscriptions) || user.pushSubscriptions.length === 0) return;

  if (payload) {
    user.pushSubscriptions.forEach((sub) => queuePushPayload(sub.endpoint, payload));
    saveState();
  }

  const results = await Promise.all(user.pushSubscriptions.map((sub) => sendWebPush(sub)));
  const alive = user.pushSubscriptions.filter((_, idx) => {
    const status = results[idx].status;
    return status !== 404 && status !== 410;
  });

  if (alive.length !== user.pushSubscriptions.length) {
    const removed = user.pushSubscriptions.filter((sub) => !alive.some((a) => a.endpoint === sub.endpoint));
    removed.forEach((sub) => removePushInbox(sub.endpoint));
    user.pushSubscriptions = alive;
    saveState();
  }
}

async function notifyPushParticipants(conversation, senderId, message) {
  const recipients = state.users.filter((u) => u.id !== senderId && canReceiveConversation(conversation, u));
  await Promise.all(recipients.map((u) => sendPushToUser(u, buildPushPayload(message, conversation, u.id))));
}

function writeJsonAtomic(filePath, payload) {
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2));
  fs.renameSync(tmp, filePath);
}

function saveState(snapshot = state) {
  writeJsonAtomic(USERS_FILE, snapshot.users || []);
  writeJsonAtomic(CONVERSATIONS_FILE, snapshot.conversations || []);
  writeJsonAtomic(MESSAGES_FILE, snapshot.messages || []);
  writeJsonAtomic(META_FILE, {
    pushInbox: snapshot.pushInbox || {},
    recentClientMessages: snapshot.recentClientMessages || {},
    mailOutbox: snapshot.mailOutbox || [],
    persistedSessions: snapshot.persistedSessions || {},
    groupInvites: snapshot.groupInvites || [],
    nextInviteId: snapshot.nextInviteId || 1,
    nextUserId: snapshot.nextUserId || 1,
    nextConversationId: snapshot.nextConversationId || 1,
    nextMessageId: snapshot.nextMessageId || 1
  });
}

normalizeLegacyUsers();
ensureSupportAdmin();
ensureDefaultSupportAgent();

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > MAX_BODY_BYTES) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function normalizeUsername(input) {
  return String(input || '').trim();
}

function normalizeText(input) {
  return String(input || '').replace(/\r/g, '').trim();
}

function isValidUsername(username) {
  return /^[a-zA-Zа-яА-Я0-9._-]{3,24}$/.test(username);
}

function consumeRateLimit(bucket, key, windowMs, limit) {
  const now = Date.now();
  const recent = (bucket.get(key) || []).filter((ts) => now - ts < windowMs);
  recent.push(now);
  bucket.set(key, recent);
  return recent.length <= limit;
}

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function verifyPassword(password, stored) {
  const [salt, expected] = String(stored).split(':');
  if (!salt || !expected) return false;
  const actual = crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'));
}

function createSession(user) {
  const token = crypto.randomBytes(24).toString('hex');
  const session = { userId: user.id, touchedAt: Date.now() };
  sessions.set(token, session);
  state.persistedSessions[token] = session;
  saveState();
  return token;
}

function cleanExpiredSessions() {
  const now = Date.now();
  let changed = false;

  for (const [token, session] of Object.entries(state.persistedSessions || {})) {
    if (!session || typeof session.touchedAt !== 'number' || now - session.touchedAt > SESSION_TTL_MS) {
      delete state.persistedSessions[token];
      sessions.delete(token);
      changed = true;
    }
  }

  if (changed) saveState();
}

function readAuth(req) {
  cleanExpiredSessions();
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;

  if (!sessions.has(token) && state.persistedSessions[token]) {
    const stored = state.persistedSessions[token];
    sessions.set(token, { userId: stored.userId, touchedAt: stored.touchedAt });
  }
  if (!sessions.has(token)) return null;

  const session = sessions.get(token);
  const user = state.users.find((u) => u.id === session.userId);
  if (!user) return null;
  return { token, user };
}

function isUserOnline(userId) {
  for (const meta of sseClients.values()) {
    if (meta.user.id === userId) return true;
  }
  return false;
}

function displayNameForViewer(user, viewerId) {
  if (user.hideName && user.id !== viewerId) return `user${user.id}`;
  return user.username;
}

function toPublicUser(user, viewerId) {
  const isSelf = user.id === viewerId;
  const canSeeOnline = isSelf || user.showOnlineStatus;
  const canSeeAvatar = isSelf || user.allowAvatarView;

  return {
    id: user.id,
    username: displayNameForViewer(user, viewerId),
    handle: user.username,
    avatar: canSeeAvatar ? user.avatar || null : null,
    canDownloadAvatar: canSeeAvatar ? (isSelf || user.allowAvatarDownload) : false,
    online: canSeeOnline ? isUserOnline(user.id) : false,
    lastSeenAt: canSeeOnline ? user.lastSeenAt || null : null,
    hideName: isSelf ? user.hideName : undefined,
    role: isSelf ? user.role : undefined,
    isSupport: isSupportRole(user),
    showOnlineStatus: isSelf ? user.showOnlineStatus : undefined,
    allowAvatarView: isSelf ? user.allowAvatarView : undefined,
    allowAvatarDownload: isSelf ? user.allowAvatarDownload : undefined
  };
}

function getConversationById(conversationId) {
  return state.conversations.find((c) => c.id === conversationId) || null;
}

function isSupportRole(user) {
  return Boolean(user && (user.role === 'support_admin' || user.role === 'support_agent'));
}

function canReceiveConversation(conversation, user) {
  if (!user) return false;
  if (conversation.type === 'support') {
    return conversation.participantIds.includes(user.id) || isSupportRole(user);
  }
  if (conversation.type === 'support_guest') {
    return isSupportRole(user);
  }
  return conversation.participantIds.includes(user.id);
}

function listConversationsForUser(user) {
  return state.conversations.filter((conversation) => canReceiveConversation(conversation, user));
}

function canAccessConversation(conversation, userId) {
  const user = state.users.find((u) => u.id === userId);
  return canReceiveConversation(conversation, user);
}


function userContactIds(userId) {
  const ids = new Set();
  state.conversations.forEach((c) => {
    if (c.type !== 'direct') return;
    if (!c.participantIds.includes(userId)) return;
    c.participantIds.forEach((id) => {
      if (id !== userId) ids.add(id);
    });
  });
  return ids;
}

function canInviteFromContacts(inviterId, candidateId) {
  if (inviterId === candidateId) return false;
  const candidate = state.users.find((u) => u.id === candidateId);
  if (!candidate || isSupportRole(candidate)) return false;
  return userContactIds(inviterId).has(candidateId);
}

function createGroupInvite(conversationId, inviterId, inviteeId) {
  const exists = state.groupInvites.find(
    (inv) =>
      inv.conversationId === conversationId &&
      inv.inviteeId === inviteeId &&
      inv.status === 'pending'
  );
  if (exists) return exists;

  const invite = {
    id: state.nextInviteId++,
    conversationId,
    inviterId,
    inviteeId,
    status: 'pending',
    createdAt: new Date().toISOString(),
    respondedAt: null
  };
  state.groupInvites.push(invite);
  return invite;
}

function serializeInvite(invite, viewerId) {
  const conversation = getConversationById(invite.conversationId);
  const inviter = state.users.find((u) => u.id === invite.inviterId);
  const invitee = state.users.find((u) => u.id === invite.inviteeId);
  return {
    id: invite.id,
    conversationId: invite.conversationId,
    conversationTitle: conversation?.title || 'Группа',
    inviterId: invite.inviterId,
    inviter: inviter ? displayNameForViewer(inviter, viewerId) : 'Пользователь',
    inviteeId: invite.inviteeId,
    invitee: invitee ? displayNameForViewer(invitee, viewerId) : 'Пользователь',
    status: invite.status,
    createdAt: invite.createdAt,
    respondedAt: invite.respondedAt
  };
}

function getOnlineSummaryForConversation(conversation) {
  const onlineIds = new Set();
  for (const meta of sseClients.values()) {
    if (canReceiveConversation(conversation, meta.user)) onlineIds.add(meta.user.id);
  }
  return onlineIds.size;
}

function serializeMessageForViewer(message, viewerId) {
  const sender = state.users.find((u) => u.id === message.senderId);
  const viewer = state.users.find((u) => u.id === viewerId);
  const conversation = getConversationById(message.conversationId);
  const isSupportConversation = conversation?.type === 'support';
  const hideSupportIdentity = isSupportConversation && !isSupportRole(viewer) && isSupportRole(sender);

  return {
    id: message.id,
    conversationId: message.conversationId,
    sender: hideSupportIdentity
      ? 'Поддержка'
      : sender
        ? displayNameForViewer(sender, viewerId)
        : message.senderName || 'Support',
    senderId: hideSupportIdentity ? 0 : message.senderId,
    text: message.text,
    attachment: message.attachment ? {
      type: message.attachment.type,
      mime: message.attachment.mime,
      name: message.attachment.name,
      size: message.attachment.size,
      url: message.attachment.url || null
    } : null,
    createdAt: message.createdAt
  };
}

function serializeConversation(conversation, requesterId) {
  const requester = state.users.find((u) => u.id === requesterId);
  const isSupportViewer = isSupportRole(requester);
  const participants = conversation.participantIds
    .map((id) => state.users.find((u) => u.id === id))
    .filter(Boolean)
    .map((u) => toPublicUser(u, requesterId));

  const last = [...state.messages].reverse().find((m) => m.conversationId === conversation.id) || null;
  const lastMessage = last ? serializeMessageForViewer(last, requesterId) : null;

  const title =
    conversation.type === 'group'
      ? conversation.title
      : conversation.type === 'support'
        ? isSupportViewer
          ? `Поддержка: ${participants[0]?.username || 'пользователь'}`
          : SUPPORT_TITLE
        : participants.find((p) => p.id !== requesterId)?.username || 'Диалог';

  return {
    id: conversation.id,
    type: conversation.type,
    title,
    participantIds: conversation.participantIds,
    participants,
    createdAt: conversation.createdAt,
    onlineCount: getOnlineSummaryForConversation(conversation),
    lastMessage
  };
}

function broadcast(event, payloadBuilder, filterFn = null) {
  for (const [res, meta] of sseClients.entries()) {
    if (res.writableEnded) {
      sseClients.delete(res);
      continue;
    }
    if (filterFn && !filterFn(meta)) continue;

    const payload = typeof payloadBuilder === 'function' ? payloadBuilder(meta) : payloadBuilder;
    const raw = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    res.write(raw);
  }
}

function broadcastConversationPresence(conversationId) {
  const conversation = getConversationById(conversationId);
  if (!conversation) return;
  broadcast(
    'presence',
    { conversationId, onlineCount: getOnlineSummaryForConversation(conversation) },
    (meta) => canReceiveConversation(conversation, meta.user)
  );
}

function broadcastConversationUpdated(conversationId) {
  const conversation = getConversationById(conversationId);
  if (!conversation) return;
  broadcast(
    'conversation_updated',
    (meta) => serializeConversation(conversation, meta.user.id),
    (meta) => canReceiveConversation(conversation, meta.user)
  );
}

function parseImageDataUrl(dataUrl, maxBytes) {
  if (typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+)(?:;[^,]*)?;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > maxBytes) return null;
  return dataUrl;
}

function parseAttachmentDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:([^;,]+)(?:;[^,]*)?;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;

  const mime = match[1];
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > MAX_ATTACHMENT_BYTES) return null;

  const type = mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : null;
  if (!type) return null;

  const ext = mime.split('/')[1]?.replace(/[^a-zA-Z0-9]/g, '') || 'bin';
  const fileName = `${type}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
  const targetPath = path.join(UPLOADS_DIR, fileName);

  let storedPath = targetPath;
  let compression = null;
  let storedSize = bytes.length;

  if (type === 'image') {
    const compressed = zlib.brotliCompressSync(bytes, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 5
      }
    });
    if (compressed.length < bytes.length) {
      storedPath = `${targetPath}.br`;
      fs.writeFileSync(storedPath, compressed);
      compression = 'br';
      storedSize = compressed.length;
    } else {
      fs.writeFileSync(storedPath, bytes);
    }
  } else {
    fs.writeFileSync(storedPath, bytes);
  }

  return {
    type,
    mime,
    name: fileName,
    size: storedSize,
    originalSize: bytes.length,
    compression,
    uploadPath: storedPath,
    url: `/uploads/${path.basename(storedPath)}`
  };
}

function readMessagesPage(conversationId, searchParams, viewerId) {
  const beforeId = Number(searchParams.get('before_id') || '0');
  const requestedLimit = Number(searchParams.get('limit') || String(DEFAULT_MESSAGES_LIMIT));
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(MAX_MESSAGES_LIMIT, Math.floor(requestedLimit)))
    : DEFAULT_MESSAGES_LIMIT;

  let source = state.messages.filter((m) => m.conversationId === conversationId);
  if (beforeId > 0) source = source.filter((m) => m.id < beforeId);

  const page = source.slice(-limit).map((m) => serializeMessageForViewer(m, viewerId));
  const hasMore = source.length > page.length;
  return { messages: page, hasMore };
}

function getOrCreateSupportConversation(userId) {
  const existing = state.conversations.find(
    (c) => c.type === 'support' && c.participantIds.length === 1 && c.participantIds[0] === userId
  );
  if (existing) return existing;

  const conversation = {
    id: state.nextConversationId++,
    type: 'support',
    title: SUPPORT_TITLE,
    participantIds: [userId],
    createdAt: new Date().toISOString()
  };

  state.conversations.push(conversation);
  saveState();
  return conversation;
}

function buildSupportReply(category) {
  const text = category
    ? `Спасибо, мы приняли обращение: "${category}". Оператор проверит и ответит в этом чате.`
    : 'Здравствуйте! Опишите проблему подробно. Мы поможем.';

  return {
    id: state.nextMessageId++,
    conversationId: 0,
    senderId: 0,
    senderName: 'Support',
    text,
    attachment: null,
    createdAt: new Date().toISOString()
  };
}

function serveStatic(req, res, pathname) {
  if (pathname.startsWith('/uploads/')) {
    const relUpload = pathname.replace(/^\/uploads\//, '');
    const uploadPath = path.resolve(UPLOADS_DIR, relUpload);
    if (!uploadPath.startsWith(UPLOADS_DIR)) return sendJson(res, 403, { error: 'Forbidden' });
    fs.readFile(uploadPath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
      const ext = path.extname(uploadPath).toLowerCase();
      const isCompressed = ext === '.br';
      const mimeByExt = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.mp4': 'video/mp4',
        '.mov': 'video/quicktime',
        '.webm': 'video/webm'
      };
      const uncompressedExt = isCompressed ? path.extname(path.basename(uploadPath, '.br')).toLowerCase() : ext;
      const type = mimeByExt[uncompressedExt] || 'application/octet-stream';
      const payload = isCompressed ? zlib.brotliDecompressSync(data) : data;
      res.writeHead(200, {
        'Content-Type': type,
        'Cache-Control': 'public, max-age=86400',
        'X-Content-Type-Options': 'nosniff'
      });
      res.end(payload);
    });
    return;
  }

  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.resolve(PUBLIC_DIR, rel);
  if (!filePath.startsWith(PUBLIC_DIR)) return sendJson(res, 403, { error: 'Forbidden' });

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath);
    const type =
      ext === '.html'
        ? 'text/html; charset=utf-8'
        : ext === '.css'
          ? 'text/css; charset=utf-8'
          : ext === '.js'
            ? 'application/javascript; charset=utf-8'
            : 'application/octet-stream';

    const isUpdateCritical = ['index.html', 'sw.js', 'manifest.webmanifest'].includes(path.basename(filePath));
    const cacheControl = isUpdateCritical ? 'no-store, no-cache, must-revalidate' : 'public, max-age=300';

    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': cacheControl,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'"
    });
    res.end(data);
  });
}

const { handleApi } = require('./routes-api');

const apiContext = {
  state,
  sessions,
  sseClients,
  ipLoginRequests,
  userMessageRequests,
  SESSION_TTL_MS,
  LOGIN_WINDOW_MS,
  LOGIN_LIMIT,
  MESSAGE_WINDOW_MS,
  MESSAGE_LIMIT,
  SUPPORT_CATEGORIES,
  VAPID_PUBLIC_KEY,
  normalizeLegacyUsers,
  ensureSupportAdmin,
  ensureDefaultSupportAgent,
  saveState,
  sendJson,
  parseBody,
  normalizeUsername,
  normalizeText,
  isValidUsername,
  consumeRateLimit,
  getClientIp,
  hashPassword,
  verifyPassword,
  createSession,
  readAuth,
  toPublicUser,
  createInitialState,
  cleanExpiredSessions,
  listConversationsForUser,
  serializeConversation,
  serializeMessageForViewer,
  getConversationById,
  canAccessConversation,
  canReceiveConversation,
  isSupportRole,
  userContactIds,
  canInviteFromContacts,
  createGroupInvite,
  serializeInvite,
  displayNameForViewer,
  isUserOnline,
  parseImageDataUrl,
  parseAttachmentDataUrl,
  readMessagesPage,
  getOrCreateSupportConversation,
  buildSupportReply,
  notifyPushParticipants,
  broadcast,
  broadcastConversationPresence,
  broadcastConversationUpdated,
  queuePushPayload,
  pullPushPayload,
  pullAllPushPayloads,
  removePushInbox,
  hasSubscriptionEndpoint,
  sendWebPush,
  buildPushPayload,
  normalizeClientMessageId,
  cleanupRecentClientMessages,
  dedupeKey,
  applyPasswordReset,
  maskEmail,
  queueEmail,
  getIceServersFromEnv,
  SUPPORT_TITLE,
  DATA_DIR,
  DB_DIR,
  UPLOADS_DIR
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/') || url.pathname === '/api' || url.pathname.startsWith('/api/app/') || url.pathname === '/api/app') {
    await handleApi(req, res, url.pathname, url.searchParams, apiContext);
    return;
  }
  serveStatic(req, res, url.pathname);
});

server.listen(PORT, () => {
  console.log(`Messenger running on http://localhost:${PORT}`);
});
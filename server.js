const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');
const DB_FILE = path.join(__dirname, 'messenger.json');
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const LOGIN_WINDOW_MS = 1000 * 60 * 5;
const LOGIN_LIMIT = 20;
const MESSAGE_WINDOW_MS = 1000 * 60;
const MESSAGE_LIMIT = 60;

const sessions = new Map();
const sseClients = new Map();
const ipLoginRequests = new Map();
const userMessageRequests = new Map();

function loadState() {
  if (!fs.existsSync(DB_FILE)) {
    return { users: [], messages: [], nextUserId: 1, nextMessageId: 1 };
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      users: parsed.users || [],
      messages: parsed.messages || [],
      nextUserId: parsed.nextUserId || 1,
      nextMessageId: parsed.nextMessageId || 1
    };
  } catch {
    return { users: [], messages: [], nextUserId: 1, nextMessageId: 1 };
  }
}

let state = loadState();

function saveState() {
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2));
  fs.renameSync(tmpFile, DB_FILE);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 32) {
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

function toPublicUser(user) {
  return { id: user.id, username: user.username };
}

function createSession(user) {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, {
    user: toPublicUser(user),
    createdAt: Date.now(),
    touchedAt: Date.now()
  });
  return token;
}

function cleanExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (now - session.touchedAt > SESSION_TTL_MS) {
      sessions.delete(token);
    }
  }
}

function readAuth(req) {
  cleanExpiredSessions();
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !sessions.has(token)) {
    return null;
  }

  const session = sessions.get(token);
  session.touchedAt = Date.now();
  return { token, user: session.user };
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, expected] = String(stored).split(':');
  if (!salt || !expected) return false;
  const actual = crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'));
}

function normalizeUsername(input) {
  return String(input || '').trim();
}

function isValidUsername(username) {
  return /^[a-zA-Zа-яА-Я0-9_-]{3,24}$/.test(username);
}

function consumeRateLimit(bucket, key, windowMs, limit) {
  const now = Date.now();
  const timeline = bucket.get(key) || [];
  const filtered = timeline.filter((ts) => now - ts < windowMs);
  filtered.push(now);
  bucket.set(key, filtered);
  return filtered.length <= limit;
}

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

function getOnlineSummary() {
  const uniqueUsers = new Map();
  for (const client of sseClients.values()) {
    uniqueUsers.set(client.user.id, client.user);
  }
  return {
    count: uniqueUsers.size,
    users: Array.from(uniqueUsers.values())
      .sort((a, b) => a.username.localeCompare(b.username))
      .map((user) => user.username)
  };
}

function broadcast(event, payload) {
  const raw = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const [res] of sseClients.entries()) {
    if (res.writableEnded) {
      sseClients.delete(res);
      continue;
    }
    res.write(raw);
  }
}

function broadcastPresence() {
  broadcast('presence', getOnlineSummary());
}

function serveStatic(req, res, pathname) {
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.resolve(PUBLIC_DIR, relativePath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath);
    const contentType =
      ext === '.html'
        ? 'text/html; charset=utf-8'
        : ext === '.css'
          ? 'text/css; charset=utf-8'
          : ext === '.js'
            ? 'application/javascript; charset=utf-8'
            : 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'"
    });
    res.end(data);
  });
}

async function handleApi(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, users: state.users.length, messages: state.messages.length });
  }

  if (req.method === 'POST' && pathname === '/api/register') {
    try {
      const body = await parseBody(req);
      const username = normalizeUsername(body.username);
      const password = String(body.password || '');

      if (!isValidUsername(username) || password.length < 6) {
        return sendJson(res, 400, {
          error: 'Invalid username or password. Username: 3-24 (letters, numbers, _, -), password: min 6.'
        });
      }

      const exists = state.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
      if (exists) {
        return sendJson(res, 409, { error: 'Username already exists' });
      }

      const user = { id: state.nextUserId++, username, passwordHash: hashPassword(password) };
      state.users.push(user);
      saveState();

      return sendJson(res, 201, { user: toPublicUser(user) });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (req.method === 'POST' && pathname === '/api/login') {
    try {
      const ip = getClientIp(req);
      if (!consumeRateLimit(ipLoginRequests, ip, LOGIN_WINDOW_MS, LOGIN_LIMIT)) {
        return sendJson(res, 429, { error: 'Too many login attempts. Try again later.' });
      }

      const body = await parseBody(req);
      const username = normalizeUsername(body.username);
      const password = String(body.password || '');

      const user = state.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
      if (!user || !verifyPassword(password, user.passwordHash)) {
        return sendJson(res, 401, { error: 'Invalid credentials' });
      }

      const token = createSession(user);
      return sendJson(res, 200, { token, user: toPublicUser(user) });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (req.method === 'POST' && pathname === '/api/logout') {
    const auth = readAuth(req);
    if (!auth) return sendJson(res, 401, { error: 'Unauthorized' });
    sessions.delete(auth.token);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'GET' && pathname === '/api/me') {
    const auth = readAuth(req);
    if (!auth) return sendJson(res, 401, { error: 'Unauthorized' });
    return sendJson(res, 200, { user: auth.user });
  }

  if (req.method === 'GET' && pathname === '/api/online') {
    const auth = readAuth(req);
    if (!auth) return sendJson(res, 401, { error: 'Unauthorized' });
    return sendJson(res, 200, getOnlineSummary());
  }

  if (req.method === 'GET' && pathname === '/api/messages') {
    const auth = readAuth(req);
    if (!auth) return sendJson(res, 401, { error: 'Unauthorized' });
    return sendJson(res, 200, { messages: state.messages.slice(-100) });
  }

  if (req.method === 'POST' && pathname === '/api/messages') {
    const auth = readAuth(req);
    if (!auth) return sendJson(res, 401, { error: 'Unauthorized' });

    const bucketKey = String(auth.user.id);
    if (!consumeRateLimit(userMessageRequests, bucketKey, MESSAGE_WINDOW_MS, MESSAGE_LIMIT)) {
      return sendJson(res, 429, { error: 'Rate limit exceeded (max 60 messages/min)' });
    }

    try {
      const body = await parseBody(req);
      const text = String(body.text || '').trim();
      if (!text) return sendJson(res, 400, { error: 'Text is required' });
      if (text.length > 1000) return sendJson(res, 400, { error: 'Text too long (max 1000)' });

      const message = {
        id: state.nextMessageId++,
        sender: auth.user.username,
        text,
        createdAt: new Date().toISOString()
      };

      state.messages.push(message);
      if (state.messages.length > 1000) {
        state.messages = state.messages.slice(-1000);
      }
      saveState();

      broadcast('message', message);
      return sendJson(res, 201, { message });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (req.method === 'GET' && pathname === '/api/events') {
    const auth = readAuth(req);
    if (!auth) return sendJson(res, 401, { error: 'Unauthorized' });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });

    res.write(`event: ready\ndata: ${JSON.stringify({ user: auth.user })}\n\n`);
    const heartbeat = setInterval(() => {
      if (!res.writableEnded) {
        res.write('event: ping\ndata: {}\n\n');
      }
    }, 15000);

    sseClients.set(res, { user: auth.user });
    broadcastPresence();

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
      broadcastPresence();
    });
    return;
  }

  return sendJson(res, 404, { error: 'Not found' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) {
    await handleApi(req, res, url.pathname);
    return;
  }

  serveStatic(req, res, url.pathname);
});

server.listen(PORT, () => {
  console.log(`Messenger running on http://localhost:${PORT}`);
});

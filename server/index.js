import dotenv from 'dotenv';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import { URL, fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envRoot = path.join(__dirname, '..');
const envMode = process.env.NODE_ENV || 'development';
const envFiles = [
  path.join(envRoot, '.env'),
  path.join(envRoot, '.env.local'),
  path.join(envRoot, `.env.${envMode}`),
  path.join(envRoot, `.env.${envMode}.local`),
];
for (const p of envFiles) {
  try {
    if (fs.existsSync(p)) dotenv.config({ path: p, override: true });
  } catch {}
}

let arcbyteLogoDataUri = '';
const getArcbyteLogoDataUri = () => {
  if (arcbyteLogoDataUri) return arcbyteLogoDataUri;
  const candidates = [
    path.join(envRoot, 'src', 'assets', 'arcbyte.co Logo_white_transparent.png'),
    path.join(envRoot, 'src', 'assets', 'arcbyte.co Logo_white_transparent.png'.replace(/ /g, '%20')),
  ];
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const buf = fs.readFileSync(p);
      arcbyteLogoDataUri = `data:image/png;base64,${buf.toString('base64')}`;
      return arcbyteLogoDataUri;
    } catch {}
  }
  arcbyteLogoDataUri = '';
  return arcbyteLogoDataUri;
};

const PROFILE_STORE_PATH = path.join(__dirname, 'account-profiles.json');
const readProfileStore = () => {
  try {
    if (!fs.existsSync(PROFILE_STORE_PATH)) return {};
    const raw = fs.readFileSync(PROFILE_STORE_PATH, 'utf8');
    if (!raw || !raw.trim()) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
};
const writeProfileStore = (store) => {
  try {
    fs.writeFileSync(PROFILE_STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
};

const PORT = Number(process.env.PORT || 5000);
const IS_PROD = process.env.NODE_ENV === 'production';

const IMAP_HOST = process.env.IMAP_HOST || 'imap.hostinger.com';
const IMAP_PORT = Number(process.env.IMAP_PORT || 993);
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.hostinger.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_PORTS = typeof process.env.SMTP_PORTS === 'string'
  ? process.env.SMTP_PORTS
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0)
  : null;
const SMTP_CONNECTION_TIMEOUT = Number(process.env.SMTP_CONNECTION_TIMEOUT || 15000);
const SMTP_GREETING_TIMEOUT = Number(process.env.SMTP_GREETING_TIMEOUT || 15000);
const SMTP_SOCKET_TIMEOUT = Number(process.env.SMTP_SOCKET_TIMEOUT || 60000);

const rawCorsOrigin = process.env.CORS_ORIGIN || 'https://mail.arcbyte.co';
const allowedOrigins = rawCorsOrigin
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const DEV_FALLBACK_SECRET = 'arcbyte-dev-secret';
const JWT_SECRET =
  process.env.JWT_SECRET ||
  process.env.SESSION_SECRET ||
  (IS_PROD ? null : DEV_FALLBACK_SECRET);
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET || JWT_SECRET;

if (IS_PROD && (!JWT_SECRET || !SESSION_SECRET)) {
  throw new Error('Missing JWT_SECRET/SESSION_SECRET');
}

const app = express();
const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    try {
      const u = new URL(origin);
      if (
        allowedOrigins.includes(origin) ||
        u.hostname === 'localhost' ||
        u.hostname === '127.0.0.1' ||
        u.hostname === 'arcbyte.co' ||
        u.hostname.endsWith('.arcbyte.co')
      ) {
        return cb(null, true);
      }
    } catch {
      return cb(null, false);
    }
    return cb(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token', 'x-mail-session'],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && typeof origin === 'string') {
    const ok =
      origin === 'https://mail.arcbyte.co' ||
      allowedOrigins.includes(origin) ||
      (() => {
        try {
          const u = new URL(origin);
          return u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === 'arcbyte.co' || u.hostname.endsWith('.arcbyte.co');
        } catch {
          return false;
        }
      })();
    if (ok) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-csrf-token, x-mail-session');
      res.setHeader('Access-Control-Max-Age', '600');
    }
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  return next();
});
app.use(express.json({ limit: '2mb' }));

// Prevent process exit on certain transient IMAP errors
const shouldIgnoreProcessError = (err) => {
  if (!err) return false;
  const code = typeof err.code === 'string' ? err.code : '';
  const msg = String(err.message || '').toLowerCase();
  return code === 'NoConnection' || msg.includes('connection not available');
};
process.on('uncaughtException', (err) => {
  if (shouldIgnoreProcessError(err)) {
    return;
  }
});
process.on('unhandledRejection', (reason) => {
  if (reason && shouldIgnoreProcessError(reason)) {
    return;
  }
});
const deriveKey = (secret) =>
  crypto.createHash('sha256').update(String(secret), 'utf8').digest();

const encryptString = (plain) => {
  const key = deriveKey(SESSION_SECRET);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
};

const decryptString = ({ iv, tag, ciphertext }) => {
  const key = deriveKey(SESSION_SECRET);
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]);
  return plain.toString('utf8');
};

const nowMs = () => Date.now();
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 8 * 60 * 60 * 1000);
const REMEMBER_ME_TTL_MS = Number(
  process.env.REMEMBER_ME_TTL_MS || 30 * 24 * 60 * 60 * 1000
);

const sessions = new Map();
const attachmentCache = new Map();
const forgotPasswordRate = new Map();
const FORGOT_PASSWORD_RATE_WINDOW_MS = Number(process.env.FORGOT_PASSWORD_RATE_WINDOW_MS || 60 * 60 * 1000);
const FORGOT_PASSWORD_RATE_MAX = Number(process.env.FORGOT_PASSWORD_RATE_MAX || 5);
const ATTACHMENT_CACHE_TTL_MS = Number(process.env.ATTACHMENT_CACHE_TTL_MS || 10 * 60 * 1000);
const ATTACHMENT_CACHE_MAX = Number(process.env.ATTACHMENT_CACHE_MAX || 50);
const ATTACHMENT_CACHE_MAX_BYTES = Number(process.env.ATTACHMENT_CACHE_MAX_BYTES || 15 * 1024 * 1024);

const attachmentCacheKey = ({ sessionId, folder, uid }) => `${sessionId}:${folder}:${uid}`;
const cleanupAttachmentCache = () => {
  const now = nowMs();
  for (const [key, entry] of attachmentCache.entries()) {
    if (!entry || typeof entry !== 'object') {
      attachmentCache.delete(key);
      continue;
    }
    if (now - (entry.createdAt || 0) > ATTACHMENT_CACHE_TTL_MS) attachmentCache.delete(key);
  }
  if (attachmentCache.size <= ATTACHMENT_CACHE_MAX) return;
  const items = Array.from(attachmentCache.entries())
    .map(([k, v]) => ({ k, t: v && typeof v === 'object' && typeof v.createdAt === 'number' ? v.createdAt : 0 }))
    .sort((a, b) => a.t - b.t);
  for (const it of items.slice(0, Math.max(0, attachmentCache.size - ATTACHMENT_CACHE_MAX))) {
    attachmentCache.delete(it.k);
  }
};

setInterval(cleanupAttachmentCache, 30_000);
setInterval(() => {
  const now = nowMs();
  for (const [ip, entry] of forgotPasswordRate.entries()) {
    if (!entry || typeof entry !== 'object' || typeof entry.resetAt !== 'number') {
      forgotPasswordRate.delete(ip);
      continue;
    }
    if (now > entry.resetAt) forgotPasswordRate.delete(ip);
  }
}, 60_000);

const createSession = ({ email, password, ttlMs }) => {
  const sessionId = crypto.randomUUID();
  const csrfToken = crypto.randomBytes(32).toString('hex');
  const encPassword = encryptString(password);
  const createdAt = nowMs();
  const ttl = typeof ttlMs === 'number' && Number.isFinite(ttlMs) ? ttlMs : SESSION_TTL_MS;
  const session = {
    id: sessionId,
    email,
    encPassword,
    csrfToken,
    createdAt,
    lastUsedAt: createdAt,
    ttlMs: ttl,
  };
  sessions.set(sessionId, session);
  return session;
};

const getSession = (sessionId) => {
  const session = sessions.get(sessionId);
  if (!session) return null;
  const expired = nowMs() - session.lastUsedAt > session.ttlMs;
  if (expired) {
    sessions.delete(sessionId);
    return null;
  }
  session.lastUsedAt = nowMs();
  return session;
};

setInterval(() => {
  const now = nowMs();
  for (const [id, s] of sessions.entries()) {
    if (now - s.lastUsedAt > s.ttlMs) sessions.delete(id);
  }
}, Math.min(60_000, Math.max(5_000, Math.floor(SESSION_TTL_MS / 20))));

const signToken = ({ sessionId, email, ttlMs, encPassword, csrfToken }) => {
  const ttl = typeof ttlMs === 'number' && Number.isFinite(ttlMs) ? ttlMs : SESSION_TTL_MS;
  return jwt.sign(
    { role: 'MAIL_USER', email, ep: encPassword, csrf: csrfToken },
    JWT_SECRET,
    { subject: sessionId, expiresIn: Math.floor(ttl / 1000) }
  );
};

const parseAuth = (req) => {
  const raw = req.headers.authorization || '';
  const [kind, token] = raw.split(' ');
  if (kind !== 'Bearer' || !token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload || typeof payload !== 'object') return null;
    const decoded = payload;
    const sessionId = typeof decoded.sub === 'string' ? decoded.sub : null;
    const email = typeof decoded.email === 'string' ? decoded.email : null;
    const role = typeof decoded.role === 'string' ? decoded.role : null;
    const encPassword =
      decoded.ep &&
      typeof decoded.ep === 'object' &&
      typeof decoded.ep.iv === 'string' &&
      typeof decoded.ep.tag === 'string' &&
      typeof decoded.ep.ciphertext === 'string'
        ? decoded.ep
        : null;
    const csrfToken = typeof decoded.csrf === 'string' ? decoded.csrf : null;
    if (!email || role !== 'MAIL_USER') return null;
    if (!sessionId && !(encPassword && csrfToken)) return null;
    return { sessionId, email, encPassword, csrfToken };
  } catch {
    return null;
  }
};

const requireAuth = (req, res, next) => {
  const auth = parseAuth(req);
  if (!auth) return res.status(401).json({ error: 'unauthorized' });
  const session = auth.sessionId ? getSession(auth.sessionId) : null;
  if (session) {
    if (session.email !== auth.email) return res.status(401).json({ error: 'unauthorized' });
    req.auth = auth;
    req.session = session;
    return next();
  }

  if (!auth.encPassword || !auth.csrfToken) return res.status(401).json({ error: 'session_expired' });
  req.auth = auth;
  req.session = {
    id: auth.sessionId || 'stateless',
    email: auth.email,
    encPassword: auth.encPassword,
    csrfToken: auth.csrfToken,
    createdAt: nowMs(),
    lastUsedAt: nowMs(),
    ttlMs: SESSION_TTL_MS,
  };
  req.auth = auth;
  return next();
};

const requireCsrf = (req, res, next) => {
  const sessionId = req.headers['x-mail-session'];
  const csrf = req.headers['x-csrf-token'];
  if (typeof csrf !== 'string') {
    return res.status(403).json({ error: 'csrf_required' });
  }
  if (csrf !== req.session.csrfToken) {
    return res.status(403).json({ error: 'csrf_invalid' });
  }
  if (req.session.id !== 'stateless' && typeof sessionId === 'string' && sessionId !== req.session.id) {
    return res.status(403).json({ error: 'csrf_invalid' });
  }
  next();
};

const resolveMailboxPath = async (client, requested) => {
  const req = String(requested || 'INBOX');
  const reqLower = req.toLowerCase();
  let suffixMatch = null;

  for await (const box of client.list()) {
    const path = typeof box.path === 'string' ? box.path : typeof box.name === 'string' ? box.name : '';
    if (!path) continue;
    const lower = path.toLowerCase();
    const specialUse = typeof box.specialUse === 'string' ? box.specialUse.toLowerCase() : '';
    const flags = box.flags instanceof Set ? box.flags : new Set();

    const desiredSpecialUse = (() => {
      if (reqLower === 'inbox') return '\\inbox';
      if (reqLower === 'sent' || reqLower === 'sent mail' || reqLower === 'sent items') return '\\sent';
      if (reqLower === 'drafts' || reqLower === 'draft') return '\\drafts';
      if (reqLower === 'trash' || reqLower === 'bin' || reqLower === 'deleted items') return '\\trash';
      if (reqLower === 'spam' || reqLower === 'junk') return '\\junk';
      return null;
    })();

    if (desiredSpecialUse) {
      const desired = desiredSpecialUse.toLowerCase();
      if (specialUse === desired) return path;
      for (const f of flags) {
        if (String(f).toLowerCase() === desired) return path;
      }
    }
    if (lower === reqLower) return path;
    if (lower.endsWith(`.${reqLower}`) || lower.endsWith(`/${reqLower}`)) {
      suffixMatch = path;
    }
  }

  return suffixMatch || req;
};

const IMAP_CONNECTION_TIMEOUT = Number(process.env.IMAP_CONNECTION_TIMEOUT || 90_000);
const IMAP_GREETING_TIMEOUT = Number(process.env.IMAP_GREETING_TIMEOUT || 16_000);
const IMAP_SOCKET_TIMEOUT = Number(process.env.IMAP_SOCKET_TIMEOUT || 300_000);
const IMAP_TLS_REJECT_UNAUTHORIZED =
  typeof process.env.IMAP_TLS_REJECT_UNAUTHORIZED === 'string'
    ? process.env.IMAP_TLS_REJECT_UNAUTHORIZED !== 'false'
    : IS_PROD;
const SMTP_TLS_REJECT_UNAUTHORIZED =
  typeof process.env.SMTP_TLS_REJECT_UNAUTHORIZED === 'string'
    ? process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false'
    : IS_PROD;

if (!IS_PROD && (!IMAP_TLS_REJECT_UNAUTHORIZED || !SMTP_TLS_REJECT_UNAUTHORIZED)) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const loadTlsCa = (envVarName) => {
  const raw = typeof process.env[envVarName] === 'string' ? process.env[envVarName].trim() : '';
  if (!raw) return undefined;
  const parts = raw
    .split(/[;,]/g)
    .map((s) => s.trim())
    .filter(Boolean);
  const cas = parts
    .map((p) => {
      const resolved = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
      return fs.readFileSync(resolved);
    })
    .filter(Boolean);
  return cas.length ? cas : undefined;
};

const IMAP_TLS_CA = loadTlsCa('IMAP_TLS_CA_FILE');
const SMTP_TLS_CA = loadTlsCa('SMTP_TLS_CA_FILE');

const isImapAuthFailure = (err) => {
  if (!err || typeof err !== 'object') return false;
  const e = err;
  if (e.authenticationFailed) return true;
  if (e.serverResponseCode === 'AUTHENTICATIONFAILED') return true;
  const responseText = String(e.responseText || e.response || '').toLowerCase();
  if (responseText.includes('authenticationfailed')) return true;
  if (responseText.includes('authentication failed')) return true;
  if (responseText.includes('invalid credentials')) return true;
  if (responseText.includes('login failed')) return true;
  const executed = String(e.executedCommand || '').toUpperCase();
  if ((executed.includes('AUTHENTICATE') || executed.includes('LOGIN')) && String(e.responseStatus || '').toUpperCase() === 'NO') {
    return true;
  }
  return false;
};

const getErrorCode = (err) => {
  if (!err || typeof err !== 'object') return undefined;
  return typeof err.code === 'string' ? err.code : undefined;
};

const isTlsErrorCode = (code) => {
  return code === 'SELF_SIGNED_CERT_IN_CHAIN' || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE';
};

const imapErrorDetails = (err) => {
  if (IS_PROD || !err || typeof err !== 'object') return undefined;
  const e = err;
  const details = {};
  if (typeof e.code === 'string') details.code = e.code;
  if (typeof e.serverResponseCode === 'string') details.serverResponseCode = e.serverResponseCode;
  if (typeof e.responseStatus === 'string') details.responseStatus = e.responseStatus;
  if (typeof e.executedCommand === 'string') details.executedCommand = e.executedCommand;
  if (typeof e.responseText === 'string') details.responseText = e.responseText.slice(0, 500);
  return Object.keys(details).length ? details : undefined;
};

const smtpErrorDetails = (err) => {
  const debug = typeof process.env.DEBUG_ERRORS === 'string' ? process.env.DEBUG_ERRORS === 'true' : false;
  if ((!debug && IS_PROD) || !err || typeof err !== 'object') return undefined;
  const e = err;
  const details = {};
  if (typeof e.code === 'string') details.code = e.code;
  if (typeof e.command === 'string') details.command = e.command;
  if (typeof e.responseCode === 'number') details.responseCode = e.responseCode;
  if (typeof e.response === 'string') details.response = e.response.slice(0, 500);
  if (typeof e.message === 'string') details.message = e.message.slice(0, 500);
  return Object.keys(details).length ? details : undefined;
};

const isSmtpAuthFailure = (err) => {
  if (!err || typeof err !== 'object') return false;
  if (err.code === 'EAUTH') return true;
  const responseText = String(err.response || err.responseText || '').toLowerCase();
  if (responseText.includes('auth') && responseText.includes('fail')) return true;
  if (responseText.includes('authentication') && responseText.includes('failed')) return true;
  if (responseText.includes('invalid login')) return true;
  if (responseText.includes('invalid credentials')) return true;
  return false;
};

const withImap = async ({ email, password, folder }, fn) => {
  const preferred = typeof process.env.IMAP_LOGIN_METHOD === 'string' ? process.env.IMAP_LOGIN_METHOD.trim() : '';
  const methods = [preferred || undefined, undefined, 'LOGIN', 'AUTH=PLAIN'];
  const unique = [];
  methods.forEach((m) => {
    if (!unique.includes(m)) unique.push(m);
  });

  let lastError = null;
  for (const loginMethod of unique) {
    const client = new ImapFlow({
      host: IMAP_HOST,
      port: IMAP_PORT,
      secure: true,
      auth: { user: email, pass: password },
      ...(loginMethod ? { loginMethod } : {}),
      connectionTimeout: IMAP_CONNECTION_TIMEOUT,
      greetingTimeout: IMAP_GREETING_TIMEOUT,
      socketTimeout: IMAP_SOCKET_TIMEOUT,
      tls: {
        rejectUnauthorized: IMAP_TLS_REJECT_UNAUTHORIZED,
        servername: IMAP_HOST,
        ca: IMAP_TLS_CA,
      },
      logger: false,
    });

    try {
      await client.connect();
      let openPath = String(folder || 'INBOX');
      try {
        await client.mailboxOpen(openPath, { readOnly: false });
      } catch {
        openPath = await resolveMailboxPath(client, openPath);
        await client.mailboxOpen(openPath, { readOnly: false });
      }
      return await fn(client);
    } catch (err) {
      lastError = err;
      if (isImapAuthFailure(err)) continue;
      throw err;
    } finally {
      try {
        await client.logout();
      } catch {
        try {
          await client.close();
        } catch {
        }
      }
    }
  }

  throw lastError;
};

const ensureSeen = async (client, uid) => {
  const verify = async () => {
    try {
      const info = await client.fetchOne(uid, { flags: true }, { uid: true });
      if (info && info.flags instanceof Set && info.flags.has('\\Seen')) return true;
    } catch {}
    try {
      const info = await client.fetchOne(String(uid), { flags: true }, { uid: true });
      if (info && info.flags instanceof Set && info.flags.has('\\Seen')) return true;
    } catch {}
    return false;
  };
  try {
    await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
  } catch {
    try {
      await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
    } catch {}
  }
  if (await verify()) return true;
  try {
    const info = await client.fetchOne(uid, {}, { uid: true });
    if (info && typeof info.seq === 'number') {
      try {
        await client.messageFlagsAdd(info.seq, ['\\Seen'], { uid: false });
      } catch {}
      if (await verify()) return true;
      try {
        await client.messageFlagsSet(info.seq, ['\\Seen'], { uid: false });
      } catch {}
    }
  } catch {}
  try {
    await client.messageFlagsSet(uid, ['\\Seen'], { uid: true });
  } catch {
    try {
      await client.messageFlagsSet(String(uid), ['\\Seen'], { uid: true });
    } catch {}
  }
  return await verify();
};

const normalizeAddressList = (value) => {
  if (!value) return [];
  const list = Array.isArray(value) ? value : value.value || [];
  return list.map((a) => ({
    name: typeof a.name === 'string' ? a.name : undefined,
    address: String(a.address || ''),
  }));
};

const buildRfc822 = ({ from, to, cc, subject, html, text }) => {
  const date = new Date().toUTCString();
  const id = `${Date.now()}.${Math.random().toString(16).slice(2)}@arcmail`;
  const boundary = `=_ArcMail_${Math.random().toString(36).slice(2)}`;
  const toHeader = Array.isArray(to) && to.length ? `To: ${to.join(', ')}\r\n` : '';
  const ccHeader = Array.isArray(cc) && cc.length ? `Cc: ${cc.join(', ')}\r\n` : '';
  const plain = (text && text.trim()) || '';
  const htmlBody = (html && html.trim()) || '';
  const hasHtml = Boolean(htmlBody);
  if (!hasHtml) {
    const lines = [
      `From: ${from}`,
      toHeader.trimEnd(),
      ccHeader.trimEnd(),
      `Date: ${date}`,
      `Message-ID: <${id}>`,
      'MIME-Version: 1.0',
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      plain,
      ''
    ].filter(Boolean);
    return lines.join('\r\n').replace(/\r?\n/g, '\r\n');
  }
  const parts = [
    `From: ${from}`,
    toHeader.trimEnd(),
    ccHeader.trimEnd(),
    `Date: ${date}`,
    `Message-ID: <${id}>`,
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    plain,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    htmlBody,
    '',
    `--${boundary}--`,
    ''
  ];
  return parts.join('\r\n').replace(/\r?\n/g, '\r\n');
};

app.get('/api/health', (_req, res) =>
  res.json({
    ok: true,
    routes: { forgotPassword: true },
  })
);

// Alias to support clients using /api/login
app.post('/api/login', (req, res) => {
  return res.status(404).json({ error: 'use_/api/auth/mail-login' });
});
app.get('/api/login', (_req, res) => res.status(405).json({ error: 'method_not_allowed' }));
app.get('/api/auth/mail-login', (_req, res) => res.status(405).json({ error: 'method_not_allowed' }));

app.post('/api/auth/mail-login', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const rememberMe = Boolean(req.body?.rememberMe);

  if (!email || !password) return res.status(400).json({ error: 'missing_credentials' });
  if (!email.includes('@')) return res.status(400).json({ error: 'invalid_email' });

  const inboxFolder = 'INBOX';
  try {
    await withImap({ email, password, folder: inboxFolder }, async () => true);
  } catch (err) {
    const code = getErrorCode(err);
    if (code && isTlsErrorCode(code)) {
      return res.status(502).json({ error: 'imap_tls_error', code });
    }
    if (isImapAuthFailure(err)) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    return res.status(502).json({ error: 'imap_unreachable', code });
  }

  const ttlMs = rememberMe ? REMEMBER_ME_TTL_MS : SESSION_TTL_MS;
  const session = createSession({ email, password, ttlMs });
  const token = signToken({
    sessionId: session.id,
    email: session.email,
    ttlMs,
    encPassword: session.encPassword,
    csrfToken: session.csrfToken,
  });
  const name = email.split('@')[0] || email;

  return res.json({
    token,
    csrfToken: session.csrfToken,
    sessionId: session.id,
    user: { name, email: session.email, role: 'MAIL_USER', status: 'Active' },
  });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const name = req.session.email.split('@')[0] || req.session.email;
  return res.json({ name, email: req.session.email, role: 'MAIL_USER', status: 'Active' });
});

app.get('/api/account/profile', requireAuth, (req, res) => {
  const emailKey = String(req.session.email || '').trim().toLowerCase();
  const store = readProfileStore();
  const entry = store && typeof store === 'object' ? store[emailKey] : null;
  const displayName = entry && typeof entry.displayName === 'string' ? entry.displayName : null;
  const avatarDataUrl = entry && typeof entry.avatarDataUrl === 'string' ? entry.avatarDataUrl : null;
  return res.json({ ok: true, profile: { displayName, avatarDataUrl } });
});

app.put('/api/account/profile', requireAuth, express.json({ limit: '600kb' }), (req, res) => {
  const emailKey = String(req.session.email || '').trim().toLowerCase();
  const displayNameRaw = typeof req.body?.displayName === 'string' ? req.body.displayName : '';
  const avatarRaw = typeof req.body?.avatarDataUrl === 'string' ? req.body.avatarDataUrl : null;

  const displayName = displayNameRaw.trim().replace(/[\r\n]+/g, ' ').slice(0, 72);
  const avatarDataUrl =
    avatarRaw && typeof avatarRaw === 'string' && avatarRaw.startsWith('data:image/') && avatarRaw.length <= 220_000 ? avatarRaw : null;

  const store = readProfileStore();
  if (!store || typeof store !== 'object' || Array.isArray(store)) return res.status(500).json({ error: 'profile_store_unavailable' });
  const prev = store[emailKey] && typeof store[emailKey] === 'object' && !Array.isArray(store[emailKey]) ? store[emailKey] : {};
  store[emailKey] = {
    ...prev,
    displayName: displayName || null,
    avatarDataUrl,
    updatedAt: new Date().toISOString(),
  };
  const ok = writeProfileStore(store);
  if (!ok) return res.status(500).json({ error: 'profile_store_write_failed' });
  return res.json({ ok: true, profile: store[emailKey] });
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
  const employeeId = typeof req.body?.employeeId === 'string' ? req.body.employeeId.trim() : '';
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
  const companyEmail = typeof req.body?.companyEmail === 'string' ? req.body.companyEmail.trim() : '';
  const altPhone = typeof req.body?.altPhone === 'string' ? req.body.altPhone.trim() : '';

  if (!fullName || !employeeId || !phone || !companyEmail || !altPhone) {
    return res.status(400).json({ error: 'invalid_payload' });
  }
  if (!/^ARC\d+$/i.test(employeeId)) return res.status(400).json({ error: 'invalid_employee_id' });
  if (!/^[6-9]\d{9}$/.test(phone)) return res.status(400).json({ error: 'invalid_phone' });
  if (!/^[6-9]\d{9}$/.test(altPhone)) return res.status(400).json({ error: 'invalid_phone' });
  const emailLower = companyEmail.toLowerCase();
  if (!emailLower.endsWith('@arcbyte.co')) return res.status(400).json({ error: 'invalid_email' });
  const local = emailLower.replace(/@arcbyte\.co$/, '');
  if (!local || !/^[a-z0-9._-]+$/.test(local)) return res.status(400).json({ error: 'invalid_email' });

  const rawIp = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  const ip = rawIp || 'unknown';
  const now = nowMs();
  const existing = forgotPasswordRate.get(ip);
  if (existing && typeof existing === 'object' && typeof existing.count === 'number' && typeof existing.resetAt === 'number') {
    if (now <= existing.resetAt && existing.count >= FORGOT_PASSWORD_RATE_MAX) {
      return res.status(429).json({ error: 'rate_limited' });
    }
    if (now > existing.resetAt) {
      forgotPasswordRate.set(ip, { count: 1, resetAt: now + FORGOT_PASSWORD_RATE_WINDOW_MS });
    } else {
      forgotPasswordRate.set(ip, { count: existing.count + 1, resetAt: existing.resetAt });
    }
  } else {
    forgotPasswordRate.set(ip, { count: 1, resetAt: now + FORGOT_PASSWORD_RATE_WINDOW_MS });
  }

  const adminTo = process.env.FORGOT_PASSWORD_TO || 'sysadmin@mail.arcbyte.co';
  const host = process.env.FORGOT_SMTP_HOST || SMTP_HOST;
  const port = Number(process.env.FORGOT_SMTP_PORT || SMTP_PORT || 465);
  const user = typeof process.env.FORGOT_SMTP_USER === 'string' ? process.env.FORGOT_SMTP_USER : '';
  const pass = typeof process.env.FORGOT_SMTP_PASS === 'string' ? process.env.FORGOT_SMTP_PASS : '';
  const from = process.env.FORGOT_SMTP_FROM || user || 'no-reply@mail.arcbyte.co';

  if (!user || !pass) return res.status(501).json({ error: 'forgot_password_unconfigured' });

  const escapeHtml = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (ch) => {
      if (ch === '&') return '&amp;';
      if (ch === '<') return '&lt;';
      if (ch === '>') return '&gt;';
      if (ch === '"') return '&quot;';
      return '&#39;';
    });

  const requestedAt = new Date();
  const requestedAtIso = requestedAt.toISOString();
  const userAgent = String(req.headers['user-agent'] || '');
  const logoDataUri = getArcbyteLogoDataUri();

  const subject = `ArcMail Password Reset Request — ${companyEmail}`;
  const text = [
    'ArcMail password reset request',
    '',
    `Full name: ${fullName}`,
    `Employee / Intern ID: ${employeeId}`,
    `Issued company mail ID: ${companyEmail}`,
    `Phone number: ${phone}`,
    `Phone number (secondary): ${altPhone}`,
    '',
    `IP: ${ip}`,
    `User-Agent: ${userAgent}`,
    `Time: ${requestedAtIso}`,
    '',
    'If this request is not expected, ignore it.',
  ].join('\n');

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark light" />
    <meta name="supported-color-schemes" content="dark light" />
    <title>${escapeHtml(subject)}</title>
    <style>
      .font {
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Inter, Roboto, Helvetica, Arial, sans-serif;
      }
      body { margin:0 !important; padding:0 !important; background:#0A0A0A !important; color:#EDEDED !important; }
      .bg { background:#0A0A0A !important; }
      .pill { background:#0F0F0F !important; border:1px solid rgba(255,255,255,0.08) !important; color:rgba(255,255,255,0.72) !important; }
      .card { background:#0B0B0B !important; border:1px solid rgba(255,255,255,0.10) !important; }
      .chip { background:#111111 !important; border:1px solid rgba(255,255,255,0.08) !important; }
      .chipTitle { color:rgba(255,255,255,0.50) !important; }
      .title { color:#FFFFFF !important; }
      .muted { color:rgba(255,255,255,0.62) !important; }
      .label { color:rgba(255,255,255,0.55) !important; }
      .value { color:#FFFFFF !important; }
      .tableHeader { background:#0F0F0F !important; color:rgba(255,255,255,0.55) !important; }
      .tableCell { background:#0B0B0B !important; }
      .fineprint { color:rgba(255,255,255,0.40) !important; }
      .brand { color:rgba(255,255,255,0.28) !important; }
      @media (prefers-color-scheme: light) {
        body { background:#F4F5F7 !important; color:#0B0B0B !important; }
        .bg { background:#F4F5F7 !important; }
        .pill { background:#FFFFFF !important; border:1px solid rgba(0,0,0,0.10) !important; color:rgba(0,0,0,0.60) !important; }
        .card { background:#FFFFFF !important; border:1px solid rgba(0,0,0,0.12) !important; }
        .chip { background:#F7F8FA !important; border:1px solid rgba(0,0,0,0.08) !important; }
        .chipTitle { color:rgba(0,0,0,0.55) !important; }
        .title { color:#0B0B0B !important; }
        .muted { color:rgba(0,0,0,0.62) !important; }
        .label { color:rgba(0,0,0,0.55) !important; }
        .value { color:#0B0B0B !important; }
        .tableHeader { background:#F0F1F3 !important; color:rgba(0,0,0,0.55) !important; }
        .tableCell { background:#FFFFFF !important; }
        .fineprint { color:rgba(0,0,0,0.45) !important; }
        .brand { color:rgba(0,0,0,0.30) !important; }
      }
    </style>
  </head>
  <body class="font" style="margin:0;padding:0;background:#0A0A0A;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,\"SF Pro Display\",\"SF Pro Text\",\"Segoe UI\",Inter,Roboto,Helvetica,Arial,sans-serif;color:#EDEDED;">
    <table role="presentation" class="bg font" data-arcbyte-email="forgot-password" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0A0A0A;padding:28px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:640px;">
            <tr>
              <td style="padding:0 0 14px 0;">
                <div class="pill" style="display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;background:#FFFFFF;border:1px solid rgba(0,0,0,0.10);color:rgba(0,0,0,0.60);font-size:12px;letter-spacing:0.14em;text-transform:uppercase;">
                  ${logoDataUri ? `<img src="${logoDataUri}" alt="ArcByte" width="14" height="14" style="display:block;width:14px;height:14px;object-fit:contain;" />` : ''}
                  <span style="font-weight:800;">ArcByte</span>
                </div>
              </td>
            </tr>

            <tr>
              <td class="card" style="border-radius:22px;overflow:hidden;border:1px solid rgba(0,0,0,0.12);background:#FFFFFF;">
                <div style="height:2px;background:linear-gradient(90deg, transparent, #1DB954, transparent);"></div>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td style="padding:22px 22px 14px 22px;">
                      <div style="display:flex;gap:12px;align-items:flex-start;">
                        <div style="width:40px;height:40px;border-radius:14px;background:#0B0B0B;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(0,0,0,0.10);">
                          ${logoDataUri
                            ? `<img src="${logoDataUri}" alt="ArcByte" width="22" height="22" style="display:block;width:22px;height:22px;object-fit:contain;" />`
                            : `<span style="font-weight:900;color:#FFFFFF;font-size:12px;letter-spacing:0.08em;">ARC</span>`}
                        </div>
                        <div style="min-width:0;">
                          <div class="title" style="font-size:18px;font-weight:800;letter-spacing:-0.02em;color:#0B0B0B;">Password Reset Request</div>
                          <div class="muted" style="margin-top:4px;font-size:13px;line-height:1.5;color:rgba(0,0,0,0.62);">
                            A user submitted a reset request from the ArcMail login screen.
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:0 22px 18px 22px;">
                      <div class="chip" style="padding:14px 16px;border-radius:16px;background:#F7F8FA;border:1px solid rgba(0,0,0,0.08);">
                        <div class="chipTitle" style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(0,0,0,0.55);">Requested Account</div>
                        <div class="value" style="margin-top:8px;font-size:16px;font-weight:900;color:#0B0B0B;word-break:break-word;">${escapeHtml(companyEmail)}</div>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:0 22px 18px 22px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-radius:16px;overflow:hidden;border:1px solid rgba(0,0,0,0.08);">
                        <tr>
                          <td class="tableHeader" colspan="2" style="padding:12px 16px;background:#F0F1F3;color:rgba(0,0,0,0.55);font-size:12px;letter-spacing:0.14em;text-transform:uppercase;">
                            Request Details
                          </td>
                        </tr>
                        <tr>
                          <td class="label tableCell" style="padding:12px 16px;background:#FFFFFF;color:rgba(0,0,0,0.55);font-size:12px;width:44%;">Full name</td>
                          <td class="value tableCell" style="padding:12px 16px;background:#FFFFFF;color:#0B0B0B;font-size:13px;font-weight:800;word-break:break-word;">${escapeHtml(fullName)}</td>
                        </tr>
                        <tr>
                          <td class="label tableCell" style="padding:12px 16px;background:#FFFFFF;color:rgba(0,0,0,0.55);font-size:12px;">Employee / Intern ID</td>
                          <td class="value tableCell" style="padding:12px 16px;background:#FFFFFF;color:#0B0B0B;font-size:13px;font-weight:800;word-break:break-word;">${escapeHtml(employeeId)}</td>
                        </tr>
                        <tr>
                          <td class="label tableCell" style="padding:12px 16px;background:#FFFFFF;color:rgba(0,0,0,0.55);font-size:12px;">Phone number</td>
                          <td class="value tableCell" style="padding:12px 16px;background:#FFFFFF;color:#0B0B0B;font-size:13px;font-weight:800;word-break:break-word;">+91 ${escapeHtml(phone)}</td>
                        </tr>
                        <tr>
                          <td class="label tableCell" style="padding:12px 16px;background:#FFFFFF;color:rgba(0,0,0,0.55);font-size:12px;">Confirm phone</td>
                          <td class="value tableCell" style="padding:12px 16px;background:#FFFFFF;color:#0B0B0B;font-size:13px;font-weight:800;word-break:break-word;">+91 ${escapeHtml(altPhone)}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:0 22px 22px 22px;">
                      <div class="chip" style="padding:14px 16px;border-radius:16px;background:#F7F8FA;border:1px solid rgba(0,0,0,0.08);">
                        <div class="chipTitle" style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(0,0,0,0.55);">Security Context</div>
                        <div class="muted" style="margin-top:10px;color:rgba(0,0,0,0.62);font-size:12px;line-height:1.55;">
                          <div><span class="label">IP:</span> <span class="value" style="font-weight:800;">${escapeHtml(ip)}</span></div>
                          <div style="margin-top:6px;"><span class="label">Time:</span> <span class="value" style="font-weight:800;">${escapeHtml(requestedAtIso)}</span></div>
                          <div style="margin-top:6px;"><span class="label">User-Agent:</span> <span class="muted" style="font-weight:600;word-break:break-word;">${escapeHtml(userAgent)}</span></div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td class="fineprint" style="padding:14px 2px 0 2px;color:rgba(0,0,0,0.45);font-size:12px;line-height:1.55;text-align:left;">
                If this request is unexpected, ignore it. Do not reply with credentials. This message was generated by ArcByte.
              </td>
            </tr>
            <tr>
              <td class="brand" style="padding:10px 2px 0 2px;color:rgba(0,0,0,0.30);font-size:11px;letter-spacing:0.14em;text-transform:uppercase;text-align:left;">
                Powered by ArcByte
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const candidates = [];
  const addCandidate = (h, p) => {
    const key = `${h}:${p}`;
    if (!candidates.some((c) => `${c.host}:${c.port}` === key)) candidates.push({ host: h, port: p });
  };
  addCandidate(host, port);
  addCandidate(host, port === 465 ? 587 : 465);
  if (host === 'smtp.hostinger.com') {
    addCandidate('smtp.titan.email', 465);
    addCandidate('smtp.titan.email', 587);
  }
  if (host === 'smtp.titan.email') {
    addCandidate('smtp.hostinger.com', 465);
    addCandidate('smtp.hostinger.com', 587);
  }

  const shouldRetrySmtp = (err) => {
    if (!err || typeof err !== 'object') return false;
    const code = 'code' in err && typeof err.code === 'string' ? err.code : '';
    return ['EAUTH', 'ETIMEDOUT', 'ECONNRESET', 'ECONNECTION', 'EHOSTUNREACH', 'ENOTFOUND'].includes(code);
  };

  let lastErr = null;
  for (const c of candidates) {
    try {
      const secure = c.port === 465;
      const transport = nodemailer.createTransport({
        host: c.host,
        port: c.port,
        secure,
        requireTLS: !secure,
        auth: { user, pass },
        connectionTimeout: SMTP_CONNECTION_TIMEOUT,
        greetingTimeout: SMTP_GREETING_TIMEOUT,
        socketTimeout: SMTP_SOCKET_TIMEOUT,
        tls: {
          rejectUnauthorized: SMTP_TLS_REJECT_UNAUTHORIZED,
          servername: c.host,
          ca: SMTP_TLS_CA,
        },
      });
      await transport.sendMail({
        from,
        to: adminTo,
        subject,
        text,
        html,
        replyTo: companyEmail,
      });
      return res.json({ ok: true });
    } catch (err) {
      lastErr = err;
      if (!shouldRetrySmtp(err)) break;
      continue;
    }
  }

  const code = lastErr && typeof lastErr === 'object' && 'code' in lastErr ? String(lastErr.code) : undefined;
  return res.status(502).json({ error: 'smtp_error', code, details: smtpErrorDetails(lastErr) });
});

app.get('/api/mail/threads', requireAuth, async (req, res) => {
  const folder = typeof req.query?.folder === 'string' ? req.query.folder : 'INBOX';
  const limitRaw = typeof req.query?.limit === 'string' ? Number(req.query.limit) : 50;
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 50;
  const cursor = typeof req.query?.cursor === 'string' ? req.query.cursor : undefined;

  let password = '';
  try {
    password = decryptString(req.session.encPassword);
  } catch {
    return res.status(401).json({ error: 'session_expired' });
  }

  try {
    const result = await withImap({ email: req.session.email, password, folder }, async (client) => {
      const exists = Number(client.mailbox?.exists || 0);
      const cursorNum = cursor ? Number(cursor) : NaN;
      const endSeq = Number.isFinite(cursorNum) ? Math.min(exists, cursorNum) : exists;
      if (!endSeq || endSeq < 1) return { threads: [], nextCursor: undefined };

      const startSeq = Math.max(1, endSeq - limit + 1);
      const range = `${startSeq}:${endSeq}`;

      const threads = [];
      for await (const msg of client.fetch(range, { envelope: true, flags: true, internalDate: true })) {
        const from = msg.envelope?.from?.[0] || null;
        const to = msg.envelope?.to || [];
        threads.push({
          id: String(msg.uid),
          subject: msg.envelope?.subject || '(no subject)',
          snippet: '',
          unread: !(msg.flags instanceof Set ? msg.flags.has('\\Seen') : false),
          from: from ? { name: from.name || undefined, address: String(from.address || '') } : null,
          to: to.map((a) => ({ name: a.name || undefined, address: String(a.address || '') })),
          lastMessageAt: (msg.envelope?.date || msg.internalDate || new Date()).toISOString(),
        });
      }

      threads.sort((a, b) => (a.lastMessageAt > b.lastMessageAt ? -1 : a.lastMessageAt < b.lastMessageAt ? 1 : 0));

      const nextCursor = startSeq > 1 ? String(startSeq - 1) : undefined;
      return { threads, nextCursor };
    });

    return res.json(result);
  } catch (err) {
    if (isImapAuthFailure(err)) return res.status(401).json({ error: 'invalid_credentials' });
    const code = getErrorCode(err);
    return res.status(502).json({ error: 'imap_error', code, details: imapErrorDetails(err) });
  }
});

app.get('/api/mail/search', requireAuth, async (req, res) => {
  const folder = typeof req.query?.folder === 'string' ? req.query.folder : 'INBOX';
  const q = typeof req.query?.q === 'string' ? req.query.q.trim() : '';
  const fromQ = typeof req.query?.from === 'string' ? req.query.from.trim() : '';
  const toQ = typeof req.query?.to === 'string' ? req.query.to.trim() : '';
  const unreadOnly = String(req.query?.unread || '').toLowerCase() === 'true';
  const flaggedOnly = String(req.query?.flagged || '').toLowerCase() === 'true';
  const answeredOnly = String(req.query?.answered || '').toLowerCase() === 'true';
  const withAttachOnly = String(req.query?.attachment || '').toLowerCase() === 'true';
  const sinceMs = typeof req.query?.since === 'string' ? Number(req.query.since) : NaN;
  const beforeMs = typeof req.query?.before === 'string' ? Number(req.query.before) : NaN;
  const limitRaw = typeof req.query?.limit === 'string' ? Number(req.query.limit) : 50;
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 50;
  const cursor = typeof req.query?.cursor === 'string' ? req.query.cursor : undefined;

  let password = '';
  try {
    password = decryptString(req.session.encPassword);
  } catch {
    return res.status(401).json({ error: 'session_expired' });
  }

  const contains = (v, s) => String(v || '').toLowerCase().includes(String(s || '').toLowerCase());
  const matchAddr = (addr, needle) => {
    if (!needle) return true;
    if (!addr) return false;
    return contains(addr.address, needle) || contains(addr.name, needle);
  };
  const matchList = (list, needle) => {
    if (!needle) return true;
    if (!Array.isArray(list)) return false;
    return list.some((a) => matchAddr(a, needle));
  };
  const inRange = (d) => {
    const t = new Date(d).getTime();
    if (Number.isFinite(sinceMs) && t < sinceMs) return false;
    if (Number.isFinite(beforeMs) && t > beforeMs) return false;
    return true;
  };

  try {
    const result = await withImap({ email: req.session.email, password, folder }, async (client) => {
      const exists = Number(client.mailbox?.exists || 0);
      const cursorNum = cursor ? Number(cursor) : NaN;
      const endSeq = Number.isFinite(cursorNum) ? Math.min(exists, cursorNum) : exists;
      if (!endSeq || endSeq < 1) return { threads: [], nextCursor: undefined };

      let collected = [];
      let nextCursor = undefined;
      let seq = endSeq;
      const minSeq = 1;
      while (seq >= minSeq && collected.length < limit) {
        const batchEnd = seq;
        const batchStart = Math.max(minSeq, batchEnd - 99);
        const range = `${batchStart}:${batchEnd}`;
        for await (const msg of client.fetch(range, { envelope: true, flags: true, internalDate: true, source: withAttachOnly })) {
          const from = msg.envelope?.from || [];
          const to = msg.envelope?.to || [];
          const subject = msg.envelope?.subject || '';
          const flagsSet = msg.flags instanceof Set ? msg.flags : new Set(Array.isArray(msg.flags) ? msg.flags : []);
          const seen = flagsSet.has('\\Seen');
          const flagged = flagsSet.has('\\Flagged');
          const answered = flagsSet.has('\\Answered');
          const date = msg.envelope?.date || msg.internalDate || new Date();
          if (!inRange(date)) continue;
          if (unreadOnly && seen) continue;
          if (flaggedOnly && !flagged) continue;
          if (answeredOnly && !answered) continue;
          if (q && !(contains(subject, q) || matchAddr(from[0], q))) continue;
          if (fromQ && !(matchList(from, fromQ))) continue;
          if (toQ && !(matchList(to, toQ))) continue;

          if (withAttachOnly) {
            let hasAttachment = false;
            try {
              if (msg.source) {
                const parsed = await simpleParser(msg.source);
                hasAttachment = Array.isArray(parsed.attachments) && parsed.attachments.length > 0;
              }
            } catch {}
            if (!hasAttachment) continue;
          }

          collected.push({
            id: String(msg.uid),
            subject: subject || '(no subject)',
            snippet: '',
            unread: !seen,
            from: from[0] ? { name: from[0].name || undefined, address: String(from[0].address || '') } : null,
            to: to.map((a) => ({ name: a.name || undefined, address: String(a.address || '') })),
            lastMessageAt: (date).toISOString(),
          });
          if (collected.length >= limit) break;
        }
        if (batchStart > minSeq) {
          seq = batchStart - 1;
          nextCursor = String(seq);
        } else {
          seq = 0;
          nextCursor = undefined;
        }
      }

      collected.sort((a, b) => (a.lastMessageAt > b.lastMessageAt ? -1 : a.lastMessageAt < b.lastMessageAt ? 1 : 0));
      return { threads: collected, nextCursor };
    });
    return res.json(result);
  } catch (err) {
    if (isImapAuthFailure(err)) return res.status(401).json({ error: 'invalid_credentials' });
    const code = getErrorCode(err);
    return res.status(502).json({ error: 'imap_error', code, details: imapErrorDetails(err) });
  }
});
app.get('/api/mail/threads/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id || '');
  const uid = Number(id);
  const folder = typeof req.query?.folder === 'string' ? req.query.folder : 'INBOX';
  if (!Number.isFinite(uid)) return res.status(400).json({ error: 'invalid_id' });

  let password = '';
  try {
    password = decryptString(req.session.encPassword);
  } catch {
    return res.status(401).json({ error: 'session_expired' });
  }

  try {
    const thread = await withImap({ email: req.session.email, password, folder }, async (client) => {
      let msg = null;
      try {
        msg = await client.fetchOne(uid, { envelope: true, flags: true, source: true }, { uid: true });
      } catch {
        msg = await client.fetchOne(String(uid), { envelope: true, flags: true, source: true }, { uid: true });
      }
      if (!msg) return null;

      // Ensure it's marked as Seen when opened
      try {
        const seen = msg.flags instanceof Set ? msg.flags.has('\\Seen') : false;
        if (!seen) {
          await ensureSeen(client, uid);
        }
      } catch {}

      const parsed = msg.source ? await simpleParser(msg.source) : null;
      const to = normalizeAddressList(parsed?.to);
      const cc = normalizeAddressList(parsed?.cc);
      const bcc = normalizeAddressList(parsed?.bcc);
      const fromAddress = msg.envelope?.from?.[0]?.address || parsed?.from?.value?.[0]?.address || '';
      const fromName = msg.envelope?.from?.[0]?.name || parsed?.from?.value?.[0]?.name || undefined;

      const attachments = (parsed?.attachments || []).map((a, i) => ({
        id: String(i + 1),
        filename: a.filename || `attachment-${i + 1}`,
        mimeType: a.contentType || 'application/octet-stream',
        size: a.size || 0,
        part: `attachment-${i + 1}`,
      }));
      try {
        const atts = Array.isArray(parsed?.attachments) ? parsed.attachments : [];
        let total = 0;
        const cached = [];
        for (let i = 0; i < atts.length; i += 1) {
          const a = atts[i];
          const content = a && a.content ? a.content : null;
          if (!content || !(content instanceof Buffer)) {
            total = ATTACHMENT_CACHE_MAX_BYTES + 1;
            break;
          }
          total += content.length;
          if (total > ATTACHMENT_CACHE_MAX_BYTES) break;
          cached.push({
            id: String(i + 1),
            filename: a.filename || `attachment-${i + 1}`,
            mimeType: a.contentType || 'application/octet-stream',
            size: typeof a.size === 'number' ? a.size : content.length,
            content,
          });
        }
        if (cached.length > 0 && total <= ATTACHMENT_CACHE_MAX_BYTES) {
          attachmentCache.set(
            attachmentCacheKey({ sessionId: req.session.id, folder, uid }),
            { createdAt: nowMs(), attachments: cached }
          );
        }
      } catch {}

      const date = (msg.envelope?.date || parsed?.date || new Date()).toISOString();
      const subject = msg.envelope?.subject || parsed?.subject || '(no subject)';

      return {
        id: String(uid),
        subject,
        folder,
        messages: [
          {
            id: String(uid),
            subject,
            fromName,
            fromAddress: String(fromAddress || ''),
            to,
            cc,
            bcc,
            date,
            text: parsed?.text || undefined,
            html: typeof parsed?.html === 'string' ? parsed.html : undefined,
            attachments,
            flags: {
              seen: msg.flags instanceof Set ? msg.flags.has('\\Seen') : false,
              flagged: msg.flags instanceof Set ? msg.flags.has('\\Flagged') : false,
              answered: msg.flags instanceof Set ? msg.flags.has('\\Answered') : false,
            },
          },
        ],
      };
    });

    return res.json({ thread });
  } catch (err) {
    if (isImapAuthFailure(err)) return res.status(401).json({ error: 'invalid_credentials' });
    const code = getErrorCode(err);
    return res.status(502).json({ error: 'imap_error', code, details: imapErrorDetails(err) });
  }
});

app.get('/api/mail/threads/:id/attachments/:attachmentId', requireAuth, async (req, res) => {
  const id = String(req.params.id || '');
  const uid = Number(id);
  const attachmentId = String(req.params.attachmentId || '');
  const attachmentIndex = Number(attachmentId) - 1;
  const requestedFilename = typeof req.query?.filename === 'string' ? req.query.filename : '';
  const requestedSize = typeof req.query?.size === 'string' ? Number(req.query.size) : NaN;
  const folder = typeof req.query?.folder === 'string' ? req.query.folder : 'INBOX';
  if (!Number.isFinite(uid)) return res.status(400).json({ error: 'invalid_id' });

  let password = '';
  try {
    password = decryptString(req.session.encPassword);
  } catch {
    return res.status(401).json({ error: 'session_expired' });
  }

  const debugErrors = typeof process.env.DEBUG_ERRORS === 'string' ? process.env.DEBUG_ERRORS === 'true' : false;

  try {
    const key = attachmentCacheKey({ sessionId: req.session.id, folder, uid });
    const cached = attachmentCache.get(key);
    if (cached && typeof cached === 'object' && Array.isArray(cached.attachments) && cached.attachments.length > 0) {
      const atts = cached.attachments;
      const displayFilenameFor = (a, i) => String(a?.filename || `attachment-${i + 1}`);
      let att = Number.isFinite(attachmentIndex) && attachmentIndex >= 0 ? atts[attachmentIndex] : null;
      if (!att && requestedFilename) {
        att = atts.find((a, i) => displayFilenameFor(a, i) === requestedFilename) || null;
        if (att && Number.isFinite(requestedSize) && typeof att.size === 'number' && att.size !== requestedSize) {
          const byNameAndSize = atts.find(
            (a, i) =>
              displayFilenameFor(a, i) === requestedFilename &&
              typeof a.size === 'number' &&
              a.size === requestedSize
          );
          if (byNameAndSize) att = byNameAndSize;
        }
      }
      if (!att && !Number.isFinite(attachmentIndex)) {
        att = atts.find((a, i) => displayFilenameFor(a, i) === attachmentId) || null;
      }
      if (att && att.content) {
        const safeName = String(att.filename || `attachment-${attachmentId}`).replace(/[\r\n"]/g, '_');
        res.setHeader('Content-Type', String(att.mimeType || 'application/octet-stream'));
        res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
        return res.status(200).send(att.content);
      }
    }
  } catch {}

  try {
    const result = await withImap({ email: req.session.email, password, folder }, async (client) => {
      let msg = null;
      try {
        msg = await client.fetchOne(uid, { source: true }, { uid: true });
      } catch {
        msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
      }
      if (!msg || !msg.source) return null;
      const parsed = await simpleParser(msg.source);
      const atts = Array.isArray(parsed.attachments) ? parsed.attachments : [];
      const displayFilenameFor = (a, i) => String(a?.filename || `attachment-${i + 1}`);
      let att =
        Number.isFinite(attachmentIndex) && attachmentIndex >= 0 ? atts[attachmentIndex] : null;
      if (!att && requestedFilename) {
        att = atts.find((a, i) => displayFilenameFor(a, i) === requestedFilename) || null;
        if (att && Number.isFinite(requestedSize) && typeof att.size === 'number' && att.size !== requestedSize) {
          const byNameAndSize = atts.find(
            (a, i) =>
              displayFilenameFor(a, i) === requestedFilename &&
              typeof a.size === 'number' &&
              a.size === requestedSize
          );
          if (byNameAndSize) att = byNameAndSize;
        }
      }
      if (!att && !Number.isFinite(attachmentIndex)) {
        att = atts.find((a, i) => displayFilenameFor(a, i) === attachmentId) || null;
      }
      if (!att) {
        if (debugErrors) {
          return {
            notFound: true,
            info: {
              attachmentId,
              attachmentIndex: Number.isFinite(attachmentIndex) ? attachmentIndex : null,
              requestedFilename: requestedFilename || null,
              requestedSize: Number.isFinite(requestedSize) ? requestedSize : null,
              attachmentsCount: atts.length,
              attachments: atts.slice(0, 20).map((a, i) => ({
                filename: displayFilenameFor(a, i),
                size: typeof a.size === 'number' ? a.size : null,
                contentType: typeof a.contentType === 'string' ? a.contentType : null,
              })),
            },
          };
        }
        return null;
      }
      const filename = String(att.filename || `attachment-${attachmentId}`);
      const mimeType = String(att.contentType || 'application/octet-stream');
      const content = att.content;
      return { filename, mimeType, content };
    });

    if (!result) return res.status(404).json({ error: 'not_found' });
    if (result && typeof result === 'object' && 'notFound' in result) {
      return res.status(404).json({ error: 'not_found', details: result.info });
    }

    const safeName = result.filename.replace(/[\r\n"]/g, '_');
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    return res.status(200).send(result.content);
  } catch (err) {
    if (isImapAuthFailure(err)) return res.status(401).json({ error: 'invalid_credentials' });
    const code = getErrorCode(err);
    return res.status(502).json({ error: 'imap_error', code, details: imapErrorDetails(err) });
  }
});

app.post('/api/mail/threads/:id/read', requireAuth, async (req, res) => {
  const id = String(req.params.id || '');
  const uid = Number(id);
  const folder = typeof req.query?.folder === 'string' ? req.query.folder : 'INBOX';
  if (!Number.isFinite(uid)) return res.status(400).json({ error: 'invalid_id' });

  let password = '';
  try {
    password = decryptString(req.session.encPassword);
  } catch {
    return res.status(401).json({ error: 'session_expired' });
  }

  try {
    const updated = await withImap({ email: req.session.email, password, folder }, async (client) => {
      return await ensureSeen(client, uid);
    });
    if (updated) return res.json({ ok: true });
    return res.status(502).json({ error: 'imap_error', code: 'UNABLE_TO_SET_SEEN' });
  } catch (err) {
    const code = getErrorCode(err);
    return res.status(502).json({ error: 'imap_error', code, details: imapErrorDetails(err) });
  }
});

app.get('/api/mail/folders/stats', requireAuth, async (req, res) => {
  let password = '';
  try {
    password = decryptString(req.session.encPassword);
  } catch {
    return res.status(401).json({ error: 'session_expired' });
  }

  const folders = {
    inbox: 'INBOX',
    sent: 'Sent',
    drafts: 'Drafts',
    spam: 'Spam',
    trash: 'Trash',
  };

  try {
    const result = await withImap({ email: req.session.email, password, folder: 'INBOX' }, async (client) => {
      const stats = {};
      for (const [key, requestedPath] of Object.entries(folders)) {
        let path = requestedPath;
        try {
          path = await resolveMailboxPath(client, requestedPath);
        } catch {
        }
        try {
          const s = await client.status(path, { messages: true, unseen: true });
          stats[key] = { messages: Number(s.messages || 0), unseen: Number(s.unseen || 0) };
        } catch {
          stats[key] = { messages: 0, unseen: 0 };
        }
      }
      return stats;
    });
    return res.json({ folders: result });
  } catch (err) {
    const code = getErrorCode(err);
    return res.status(502).json({ error: 'imap_error', code, details: imapErrorDetails(err) });
  }
});

app.get('/api/mail/diagnostics/folders', requireAuth, async (req, res) => {
  let password = '';
  try {
    password = decryptString(req.session.encPassword);
  } catch {
    return res.status(401).json({ error: 'session_expired' });
  }
  try {
    const result = await withImap({ email: req.session.email, password, folder: 'INBOX' }, async (client) => {
      const folders = [];
      for await (const box of client.list()) {
        folders.push({
          path: String(box.path || box.name || ''),
          name: String(box.name || ''),
          specialUse: typeof box.specialUse === 'string' ? box.specialUse : null,
          flags: box.flags instanceof Set ? Array.from(box.flags) : [],
        });
      }
      return folders;
    });
    return res.json({ folders: result });
  } catch (err) {
    const code = getErrorCode(err);
    return res.status(502).json({ error: 'imap_error', code, details: imapErrorDetails(err) });
  }
});

app.post('/api/mail/send', requireAuth, requireCsrf, async (req, res) => {
  let password = '';
  try {
    password = decryptString(req.session.encPassword);
  } catch {
    return res.status(401).json({ error: 'session_expired' });
  }

  const to = Array.isArray(req.body?.to) ? req.body.to.map(String) : [];
  const cc = Array.isArray(req.body?.cc) ? req.body.cc.map(String) : [];
  const bcc = Array.isArray(req.body?.bcc) ? req.body.bcc.map(String) : [];
  const subject = typeof req.body?.subject === 'string' ? req.body.subject : '';
  const htmlRaw = typeof req.body?.html === 'string' ? req.body.html : undefined;
  const textRaw = typeof req.body?.text === 'string' ? req.body.text : undefined;
  const fromNameRaw = typeof req.body?.fromName === 'string' ? req.body.fromName : '';
  const fromName = fromNameRaw.trim().replace(/[\r\n]+/g, ' ').slice(0, 72);
  const fromAvatarRaw = typeof req.body?.fromAvatarDataUrl === 'string' ? req.body.fromAvatarDataUrl : '';
  const fromAvatarDataUrl =
    typeof fromAvatarRaw === 'string' && fromAvatarRaw.startsWith('data:image/') && fromAvatarRaw.length <= 220_000
      ? fromAvatarRaw
      : '';

  const escapeHtml = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (ch) => {
      if (ch === '&') return '&amp;';
      if (ch === '<') return '&lt;';
      if (ch === '>') return '&gt;';
      if (ch === '"') return '&quot;';
      return '&#39;';
    });

  const baseSignatureName = fromName || String(req.session.email || '').split('@')[0] || 'ArcMail';
  const signatureHtml =
    fromAvatarDataUrl || fromName
      ? `<div style="margin-top:24px;padding-top:14px;border-top:1px solid rgba(127,127,127,0.25);">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
    <tr>
      <td style="padding:0 10px 0 0;vertical-align:middle;">
        ${
          fromAvatarDataUrl
            ? `<img src="${escapeHtml(fromAvatarDataUrl)}" width="36" height="36" alt="${escapeHtml(
                baseSignatureName
              )}" style="display:block;width:36px;height:36px;border-radius:999px;object-fit:cover;" />`
            : `<div style="width:36px;height:36px;border-radius:999px;background:#1DB954;color:#000;font-weight:900;display:flex;align-items:center;justify-content:center;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">${escapeHtml(
                String(baseSignatureName || '?')[0]?.toUpperCase() || '?'
              )}</div>`
        }
      </td>
      <td style="vertical-align:middle;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
        <div style="font-weight:800;font-size:13px;line-height:1.2;color:inherit;">${escapeHtml(baseSignatureName)}</div>
        <div style="font-weight:600;font-size:12px;line-height:1.2;color:rgba(127,127,127,0.95);">${escapeHtml(
          req.session.email
        )}</div>
      </td>
    </tr>
  </table>
</div>`
      : '';

  const htmlBase = htmlRaw && htmlRaw.trim() ? htmlRaw : undefined;
  const textBase = textRaw && textRaw.trim() ? textRaw : undefined;
  const html = htmlBase ? `${htmlBase}${signatureHtml}` : signatureHtml || undefined;
  const text = textBase
    ? `${textBase}${fromName || fromAvatarDataUrl ? `\n\n—\n${baseSignatureName}\n${req.session.email}` : ''}`
    : fromName || fromAvatarDataUrl
      ? `${baseSignatureName}\n${req.session.email}`
      : undefined;

  if (!to.length || !subject.trim()) return res.status(400).json({ error: 'invalid_payload' });

  const fromHeader = fromName ? `${fromName} <${req.session.email}>` : req.session.email;
  const from = fromName ? { name: fromName, address: req.session.email } : req.session.email;

  const sendMailOptions = {
    from,
    to,
    cc: cc.length ? cc : undefined,
    bcc: bcc.length ? bcc : undefined,
    subject: subject.trim(),
    html,
    text,
    headers: fromName ? { 'X-ArcMail-From-Name': fromName } : undefined,
  };

  const storeMailOptions = {
    from,
    to,
    cc: cc.length ? cc : undefined,
    subject: subject.trim(),
    html,
    text,
  };

  let rawMessage = null;
  try {
    // Build an RFC822 message with CRLF line endings for IMAP APPEND compatibility
    const rawTransport = nodemailer.createTransport({
      streamTransport: true,
      buffer: true,
      newline: 'windows',
    });
    const info = await rawTransport.sendMail(storeMailOptions);
    const msg = info && typeof info === 'object' && 'message' in info ? info.message : null;
    if (Buffer.isBuffer(msg)) {
      rawMessage = msg;
    } else if (typeof msg === 'string') {
      rawMessage = msg;
    } else {
      rawMessage = null;
    }
  } catch {
    rawMessage = null;
  }
  if (!rawMessage) {
    const fromAddr = req.session.email;
    const toHeader = to.join(', ');
    const ccHeader = cc.length ? cc.join(', ') : undefined;
    const rfc822 = buildRfc822({
      from: fromHeader || fromAddr,
      to: [toHeader].filter(Boolean),
      cc: ccHeader ? [ccHeader] : [],
      subject: subject.trim(),
      html: html || '',
      text: text || '',
    });
    rawMessage = rfc822;
  }

  const sendWith = async (transport) => {
    return await transport.sendMail(sendMailOptions);
  };

  const tryAppendToSent = async (client, raw) => {
    const candidates = [
      'Sent',
      'Sent Mail',
      'Sent Items',
      'INBOX.Sent',
      'INBOX/Sent',
      'INBOX.Sent Mail',
      'INBOX.Sent Items',
      '[Gmail]/Sent Mail',
    ];
    // Prefer resolveMailboxPath result
    const resolved = await resolveMailboxPath(client, 'Sent').catch(() => null);
    const list = [];
    if (resolved && !candidates.includes(resolved)) list.push(resolved);
    list.push(...candidates);

    for (const name of list) {
      try {
        await client.append(name, raw, ['\\Seen'], new Date());
        return { ok: true, path: name };
      } catch {
        try {
          // Try resolve variations again
          const alt = await resolveMailboxPath(client, name);
          if (alt && alt !== name) {
            await client.append(alt, raw, ['\\Seen'], new Date());
            return { ok: true, path: alt };
          }
        } catch {
          // ignore and continue
        }
      }
    }
    // Try to create a Sent mailbox and append
    try {
      const created = await client.mailboxCreate('Sent').catch(() => null);
      if (created) {
        try {
          await client.append('Sent', raw, ['\\Seen'], new Date());
          return { ok: true, path: 'Sent' };
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
    return { ok: false };
  };

  try {
    const makeTransport = (port) => {
      const secure = port === 465;
      return nodemailer.createTransport({
        host: SMTP_HOST,
        port,
        secure,
        requireTLS: !secure,
        auth: { user: req.session.email, pass: password },
        connectionTimeout: SMTP_CONNECTION_TIMEOUT,
        greetingTimeout: SMTP_GREETING_TIMEOUT,
        socketTimeout: SMTP_SOCKET_TIMEOUT,
        tls: {
          rejectUnauthorized: SMTP_TLS_REJECT_UNAUTHORIZED,
          servername: SMTP_HOST,
          ca: SMTP_TLS_CA,
        },
      });
    };

    const portsToTry = (SMTP_PORTS && SMTP_PORTS.length > 0
      ? SMTP_PORTS
      : [SMTP_PORT, SMTP_PORT === 465 ? 587 : 465]
    ).filter((v, i, a) => a.indexOf(v) === i);

    let lastErr = null;
    for (const port of portsToTry) {
      try {
        const transport = makeTransport(port);
        const result = await sendWith(transport);
        const messageId = typeof result?.messageId === 'string' ? result.messageId : undefined;
        let savedTo = null;
        if (rawMessage) {
          try {
            await withImap({ email: req.session.email, password, folder: 'INBOX' }, async (client) => {
              const r = await tryAppendToSent(client, rawMessage);
              if (r.ok) savedTo = r.path;
              return true;
            });
          } catch {}
        }
        return res.json({ ok: true, messageId, savedTo, from: fromHeader });
      } catch (err) {
        if (isSmtpAuthFailure(err)) return res.status(401).json({ error: 'invalid_credentials' });
        lastErr = err;
      }
    }

    const code = lastErr && typeof lastErr === 'object' && 'code' in lastErr ? String(lastErr.code) : undefined;
    return res.status(502).json({ error: 'smtp_error', code, details: smtpErrorDetails(lastErr) });
  } catch (err) {
    if (isSmtpAuthFailure(err)) return res.status(401).json({ error: 'invalid_credentials' });
    const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : undefined;
    return res.status(502).json({ error: 'smtp_error', code, details: smtpErrorDetails(err) });
  }
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  sessions.delete(req.session.id);
  return res.json({ ok: true });
});

const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    return res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.use((_req, res) => {
  return res.status(404).json({ error: 'not_found' });
});

app.use((err, _req, res, _next) => {
  const status = err?.message === 'Not allowed by CORS' ? 403 : 500;
  return res.status(status).json({ error: 'server_error' });
});

const server = app.listen(PORT, () => {
  const origin = allowedOrigins.length ? allowedOrigins[0] : 'unknown';
  const apiUrl = new URL(`http://localhost:${PORT}/api/health`);
  console.log(`API listening on ${apiUrl.toString()} (CORS: ${origin})`);
});

server.ref?.();

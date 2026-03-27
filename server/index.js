import 'dotenv/config';
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

const PORT = Number(process.env.PORT || 5000);
const IS_PROD = process.env.NODE_ENV === 'production';

const IMAP_HOST = process.env.IMAP_HOST || 'imap.hostinger.com';
const IMAP_PORT = Number(process.env.IMAP_PORT || 993);
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.hostinger.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);

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
app.use(express.json({ limit: '2mb' }));
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      try {
        const u = new URL(origin);
        if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return cb(null, true);
      } catch {
        return cb(new Error('Not allowed by CORS'));
      }
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

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
        await client.mailboxOpen(openPath);
      } catch {
        openPath = await resolveMailboxPath(client, openPath);
        await client.mailboxOpen(openPath);
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

const normalizeAddressList = (value) => {
  if (!value) return [];
  const list = Array.isArray(value) ? value : value.value || [];
  return list.map((a) => ({
    name: typeof a.name === 'string' ? a.name : undefined,
    address: String(a.address || ''),
  }));
};

app.get('/api/health', (_req, res) => res.json({ ok: true }));

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
        threads.push({
          id: String(msg.uid),
          subject: msg.envelope?.subject || '(no subject)',
          snippet: '',
          unread: !(msg.flags instanceof Set ? msg.flags.has('\\Seen') : false),
          from: from ? { name: from.name || undefined, address: String(from.address || '') } : null,
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
        msg = await client.fetchOne(uid, { uid: true, envelope: true, flags: true, source: true });
      }
      if (!msg) return null;

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
  const html = htmlRaw && htmlRaw.trim() ? htmlRaw : undefined;
  const text = textRaw && textRaw.trim() ? textRaw : undefined;

  if (!to.length || !subject.trim()) return res.status(400).json({ error: 'invalid_payload' });

  const sendWith = async (transport) => {
    return await transport.sendMail({
      from: req.session.email,
      to,
      cc: cc.length ? cc : undefined,
      bcc: bcc.length ? bcc : undefined,
      subject: subject.trim(),
      html,
      text,
    });
  };

  try {
    const primary = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: req.session.email, pass: password },
      tls: {
        rejectUnauthorized: SMTP_TLS_REJECT_UNAUTHORIZED,
        servername: SMTP_HOST,
        ca: SMTP_TLS_CA,
      },
    });
    const result = await sendWith(primary);
    const messageId = typeof result?.messageId === 'string' ? result.messageId : undefined;
    return res.json({ ok: true, messageId });
  } catch (err) {
    if (isSmtpAuthFailure(err)) return res.status(401).json({ error: 'invalid_credentials' });
    if (SMTP_PORT === 465) {
      try {
        const fallback = nodemailer.createTransport({
          host: SMTP_HOST,
          port: 587,
          secure: false,
          requireTLS: true,
          auth: { user: req.session.email, pass: password },
          tls: {
            rejectUnauthorized: SMTP_TLS_REJECT_UNAUTHORIZED,
            servername: SMTP_HOST,
            ca: SMTP_TLS_CA,
          },
        });
        const result = await sendWith(fallback);
        const messageId = typeof result?.messageId === 'string' ? result.messageId : undefined;
        return res.json({ ok: true, messageId });
      } catch {
        const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : undefined;
        return res.status(502).json({ error: 'smtp_error', code });
      }
    }
    const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : undefined;
    return res.status(502).json({ error: 'smtp_error', code });
  }
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  sessions.delete(req.session.id);
  return res.json({ ok: true });
});

const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
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

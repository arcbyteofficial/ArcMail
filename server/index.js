import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import { URL } from 'node:url';

const PORT = Number(process.env.PORT || 5000);

const IMAP_HOST = process.env.IMAP_HOST || 'imap.hostinger.com';
const IMAP_PORT = Number(process.env.IMAP_PORT || 993);
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.hostinger.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);

const rawCorsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5174';
const allowedOrigins = rawCorsOrigin
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const JWT_SECRET =
  process.env.JWT_SECRET ||
  process.env.SESSION_SECRET ||
  crypto.randomBytes(32).toString('hex');
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET || JWT_SECRET;

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

const signToken = ({ sessionId, email, ttlMs }) => {
  const ttl = typeof ttlMs === 'number' && Number.isFinite(ttlMs) ? ttlMs : SESSION_TTL_MS;
  return jwt.sign(
    { role: 'MAIL_USER', email },
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
    if (!sessionId || !email || role !== 'MAIL_USER') return null;
    return { sessionId, email };
  } catch {
    return null;
  }
};

const requireAuth = (req, res, next) => {
  const auth = parseAuth(req);
  if (!auth) return res.status(401).json({ error: 'unauthorized' });
  const session = getSession(auth.sessionId);
  if (!session) return res.status(401).json({ error: 'session_expired' });
  if (session.email !== auth.email) return res.status(401).json({ error: 'unauthorized' });
  req.auth = auth;
  req.session = session;
  next();
};

const requireCsrf = (req, res, next) => {
  const sessionId = req.headers['x-mail-session'];
  const csrf = req.headers['x-csrf-token'];
  if (typeof sessionId !== 'string' || typeof csrf !== 'string') {
    return res.status(403).json({ error: 'csrf_required' });
  }
  if (sessionId !== req.session.id || csrf !== req.session.csrfToken) {
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

const withImap = async ({ email, password, folder }, fn) => {
  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: { user: email, pass: password },
    logger: false,
  });
  await client.connect();
  try {
    let openPath = String(folder || 'INBOX');
    try {
      await client.mailboxOpen(openPath);
    } catch {
      openPath = await resolveMailboxPath(client, openPath);
      await client.mailboxOpen(openPath);
    }
    return await fn(client);
  } finally {
    try {
      await client.logout();
    } catch {
      try {
        await client.close();
      } catch {
        return;
      }
    }
  }
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
  } catch {
    return res.status(401).json({ error: 'invalid_credentials' });
  }

  const ttlMs = rememberMe ? REMEMBER_ME_TTL_MS : SESSION_TTL_MS;
  const session = createSession({ email, password, ttlMs });
  const token = signToken({ sessionId: session.id, email: session.email, ttlMs });
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

  const password = decryptString(req.session.encPassword);

  try {
    const result = await withImap({ email: req.session.email, password, folder }, async (client) => {
      const uids = (await client.search({ all: true })).sort((a, b) => a - b);
      let end = uids.length;
      if (cursor) {
        const cursorNum = Number(cursor);
        const idx = Number.isFinite(cursorNum) ? uids.findIndex((u) => u === cursorNum) : -1;
        if (idx >= 0) end = idx;
      }
      const slice = uids.slice(Math.max(0, end - limit), end);
      const pageUids = slice.sort((a, b) => b - a);

      const threads = [];
      for await (const msg of client.fetch(pageUids, { uid: true, envelope: true, flags: true, internalDate: true })) {
        const from = msg.envelope?.from?.[0] || null;
        threads.push({
          id: String(msg.uid),
          subject: msg.envelope?.subject || '(no subject)',
          snippet: '',
          unread: !(msg.flags || []).includes('\\Seen'),
          from: from ? { name: from.name || undefined, address: String(from.address || '') } : null,
          lastMessageAt: (msg.envelope?.date || msg.internalDate || new Date()).toISOString(),
        });
      }

      const nextCursor = pageUids.length ? String(Math.min(...pageUids)) : undefined;
      return { threads, nextCursor };
    });

    return res.json(result);
  } catch {
    return res.status(502).json({ error: 'imap_error' });
  }
});

app.get('/api/mail/threads/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id || '');
  const uid = Number(id);
  const folder = typeof req.query?.folder === 'string' ? req.query.folder : 'INBOX';
  if (!Number.isFinite(uid)) return res.status(400).json({ error: 'invalid_id' });

  const password = decryptString(req.session.encPassword);

  try {
    const thread = await withImap({ email: req.session.email, password, folder }, async (client) => {
      const msg = await client.fetchOne(uid, { uid: true, envelope: true, flags: true, source: true });
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
              seen: (msg.flags || []).includes('\\Seen'),
              flagged: (msg.flags || []).includes('\\Flagged'),
              answered: (msg.flags || []).includes('\\Answered'),
            },
          },
        ],
      };
    });

    return res.json({ thread });
  } catch {
    return res.status(502).json({ error: 'imap_error' });
  }
});

app.post('/api/mail/send', requireAuth, requireCsrf, async (req, res) => {
  const password = decryptString(req.session.encPassword);

  const to = Array.isArray(req.body?.to) ? req.body.to.map(String) : [];
  const cc = Array.isArray(req.body?.cc) ? req.body.cc.map(String) : [];
  const bcc = Array.isArray(req.body?.bcc) ? req.body.bcc.map(String) : [];
  const subject = typeof req.body?.subject === 'string' ? req.body.subject : '';
  const html = typeof req.body?.html === 'string' ? req.body.html : undefined;
  const text = typeof req.body?.text === 'string' ? req.body.text : undefined;

  if (!to.length || !subject.trim()) return res.status(400).json({ error: 'invalid_payload' });

  try {
    const transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: req.session.email, pass: password },
    });

    const result = await transport.sendMail({
      from: req.session.email,
      to,
      cc: cc.length ? cc : undefined,
      bcc: bcc.length ? bcc : undefined,
      subject: subject.trim(),
      html,
      text,
    });

    const messageId = typeof result?.messageId === 'string' ? result.messageId : undefined;
    return res.json({ ok: true, messageId });
  } catch {
    return res.status(502).json({ error: 'smtp_error' });
  }
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  sessions.delete(req.session.id);
  return res.json({ ok: true });
});

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

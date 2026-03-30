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
import webpush from 'web-push';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Pool } from 'pg';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { URL, fileURLToPath } from 'node:url';
import { generateReply, runAI } from './services/ai.js';
import { getEmailAI, getEmailAIBatch, processIncomingEmail, scheduleProcessIncomingEmail } from './services/intelligence.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envRoot = path.join(__dirname, '..');
const envMode = process.env.NODE_ENV || 'development';
const envIsProd = envMode === 'production';
const envFiles = [
  path.join(envRoot, '.env'),
  path.join(envRoot, '.env.local'),
  path.join(envRoot, `.env.${envMode}`),
  path.join(envRoot, `.env.${envMode}.local`),
];
for (const p of envFiles) {
  try {
    if (fs.existsSync(p)) dotenv.config({ path: p, override: !envIsProd });
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

let profileStore = readProfileStore();
const getProfileEntry = (emailKey) => {
  const store = profileStore && typeof profileStore === 'object' && !Array.isArray(profileStore) ? profileStore : {};
  const entry = store && typeof store === 'object' ? store[emailKey] : null;
  return entry && typeof entry === 'object' && !Array.isArray(entry) ? entry : null;
};
const setProfileEntry = (emailKey, value) => {
  const store = profileStore && typeof profileStore === 'object' && !Array.isArray(profileStore) ? profileStore : {};
  const next = { ...store, [emailKey]: value };
  profileStore = next;
  return writeProfileStore(next);
};

const streamToBuffer = async (body) => {
  if (!body) return Buffer.from([]);
  if (Buffer.isBuffer(body)) return body;
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
};

const parseImageDataUrl = (dataUrl) => {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!match) return null;
  const contentType = match[1];
  const base64 = match[2];
  try {
    const buf = Buffer.from(base64, 'base64');
    return { contentType, buf };
  } catch {
    return null;
  }
};

const emailKeyHash = (emailKey) => crypto.createHash('sha256').update(String(emailKey || '').trim().toLowerCase()).digest('hex');
const profileObjectKey = (emailKey) => `profiles/${emailKeyHash(emailKey).slice(0, 32)}/profile.json`;
const avatarObjectKey = (emailKey, extension) => {
  const safeExt = typeof extension === 'string' && extension ? extension.replace(/[^a-z0-9]/gi, '').slice(0, 8) : 'img';
  const rand = crypto.randomBytes(8).toString('hex');
  return `avatars/${emailKeyHash(emailKey).slice(0, 32)}/${Date.now()}-${rand}.${safeExt}`;
};

const getStoredProfile = async (emailKey) => {
  if (!s3) return null;
  try {
    const out = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: profileObjectKey(emailKey) }));
    const buf = await streamToBuffer(out.Body);
    const raw = buf.toString('utf8');
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const displayName = typeof parsed.displayName === 'string' ? parsed.displayName : null;
    const avatarUrl = typeof parsed.avatarUrl === 'string' ? parsed.avatarUrl : null;
    return { displayName, avatarUrl };
  } catch {
    return null;
  }
};

const putStoredProfile = async (emailKey, profile) => {
  if (!s3) return false;
  try {
    const body = JSON.stringify(profile, null, 2);
    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: profileObjectKey(emailKey),
        Body: body,
        ContentType: 'application/json; charset=utf-8',
        CacheControl: 'no-store',
      })
    );
    return true;
  } catch {
    return false;
  }
};

const deleteStoredProfile = async (emailKey) => {
  if (!s3) return false;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: profileObjectKey(emailKey) }));
    return true;
  } catch {
    return false;
  }
};

const PORT = Number(process.env.PORT || 5000);
const IS_PROD = process.env.NODE_ENV === 'production';
const SERVER_BUILD_ID = new Date().toISOString();
const DEV_ADMIN_TOKEN = typeof process.env.DEV_ADMIN_TOKEN === 'string' ? process.env.DEV_ADMIN_TOKEN.trim() : '';
const ADMIN_RESET_2FA_TOKEN = typeof process.env.ADMIN_RESET_2FA_TOKEN === 'string' ? process.env.ADMIN_RESET_2FA_TOKEN.trim() : '';
const REQUIRE_2FA_ON_LOGIN = (() => {
  const raw = typeof process.env.REQUIRE_2FA_ON_LOGIN === 'string' ? process.env.REQUIRE_2FA_ON_LOGIN.trim().toLowerCase() : '';
  if (!raw) return true;
  if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'off') return false;
  return true;
})();

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
const DEFAULT_CORS_ORIGIN = allowedOrigins[0] || 'https://mail.arcbyte.co';

const VAPID_PUBLIC_KEY = typeof process.env.VAPID_PUBLIC_KEY === 'string' ? process.env.VAPID_PUBLIC_KEY.trim() : '';
const VAPID_PRIVATE_KEY = typeof process.env.VAPID_PRIVATE_KEY === 'string' ? process.env.VAPID_PRIVATE_KEY.trim() : '';
const VAPID_SUBJECT = typeof process.env.VAPID_SUBJECT === 'string' ? process.env.VAPID_SUBJECT.trim() : 'mailto:sysadmin@mail.arcbyte.co';
const PUSH_ENABLED = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
if (PUSH_ENABLED) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  } catch {
  }
}

const S3_BUCKET = typeof process.env.S3_BUCKET === 'string' ? process.env.S3_BUCKET.trim() : '';
const S3_REGION = typeof process.env.S3_REGION === 'string' ? process.env.S3_REGION.trim() : '';
const S3_ENDPOINT = typeof process.env.S3_ENDPOINT === 'string' ? process.env.S3_ENDPOINT.trim() : '';
const S3_ACCESS_KEY_ID = typeof process.env.S3_ACCESS_KEY_ID === 'string' ? process.env.S3_ACCESS_KEY_ID.trim() : '';
const S3_SECRET_ACCESS_KEY = typeof process.env.S3_SECRET_ACCESS_KEY === 'string' ? process.env.S3_SECRET_ACCESS_KEY.trim() : '';
const S3_PUBLIC_BASE_URL = typeof process.env.S3_PUBLIC_BASE_URL === 'string' ? process.env.S3_PUBLIC_BASE_URL.trim().replace(/\/+$/, '') : '';
const S3_FORCE_PATH_STYLE = process.env.S3_FORCE_PATH_STYLE === '1' || process.env.S3_FORCE_PATH_STYLE === 'true';
const S3_ENABLED = Boolean(S3_BUCKET && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY);
const s3 = S3_ENABLED
  ? new S3Client({
      region: S3_REGION || 'auto',
      endpoint: S3_ENDPOINT || undefined,
      forcePathStyle: S3_FORCE_PATH_STYLE,
      credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
    })
  : null;

const DATABASE_URL = typeof process.env.DATABASE_URL === 'string' ? process.env.DATABASE_URL.trim() : '';
const db = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL, ssl: process.env.PGSSLMODE === 'disable' ? false : undefined }) : null;
const GROQ_API_KEY = typeof process.env.GROQ_API_KEY === 'string' ? process.env.GROQ_API_KEY.trim() : '';
const ARCMAIL_AI_DISABLED = (() => {
  const raw = typeof process.env.ARCMAIL_AI_DISABLED === 'string' ? process.env.ARCMAIL_AI_DISABLED.trim().toLowerCase() : '';
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
})();
const ARCMAIL_AI_ENABLED = Boolean(GROQ_API_KEY) && !ARCMAIL_AI_DISABLED;
const REQUIRE_PERSISTENT_2FA_STORAGE = (() => {
  if (!IS_PROD) return false;
  const raw = typeof process.env.ALLOW_EPHEMERAL_2FA_STORAGE === 'string' ? process.env.ALLOW_EPHEMERAL_2FA_STORAGE.trim().toLowerCase() : '';
  if (raw === '1' || raw === 'true' || raw === 'yes') return false;
  return true;
})();

const DEV_FALLBACK_SECRET = 'arcbyte-dev-secret';
const JWT_SECRET =
  process.env.JWT_SECRET ||
  process.env.SESSION_SECRET ||
  (IS_PROD ? null : DEV_FALLBACK_SECRET);
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET || JWT_SECRET;
const ADMIN_USERNAME = typeof process.env.ADMIN_USERNAME === 'string' ? process.env.ADMIN_USERNAME.trim() : '';
const ADMIN_PASSWORD = typeof process.env.ADMIN_PASSWORD === 'string' ? process.env.ADMIN_PASSWORD : '';
const ADMIN_JWT_SECRET = `${String(JWT_SECRET)}:admin`;
const ADMIN_SESSION_TTL_MS = Number(process.env.ADMIN_SESSION_TTL_MS || 12 * 60 * 60 * 1000);
const ADMIN_ALLOW_PASSWORD_EMAIL = (() => {
  const raw = typeof process.env.ADMIN_ALLOW_PASSWORD_EMAIL === 'string' ? process.env.ADMIN_ALLOW_PASSWORD_EMAIL.trim().toLowerCase() : '';
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
})();

if (IS_PROD && (!JWT_SECRET || !SESSION_SECRET)) {
  throw new Error('Missing JWT_SECRET/SESSION_SECRET');
}

if (REQUIRE_PERSISTENT_2FA_STORAGE && !db) {
  throw new Error('Missing DATABASE_URL (required for persistent 2FA/admin storage in production)');
}

const app = express();
if (!IS_PROD) {
  app.use((req, _res, next) => {
    try {
      console.log(`[REQ] ${req.method} ${req.url}`);
    } catch {
    }
    next();
  });
}
const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, DEFAULT_CORS_ORIGIN);
    try {
      const u = new URL(origin);
      if (
        allowedOrigins.includes(origin) ||
        u.hostname === 'localhost' ||
        u.hostname === '127.0.0.1' ||
        u.hostname === 'arcbyte.co' ||
        u.hostname.endsWith('.arcbyte.co')
      ) {
        return cb(null, origin);
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

app.use((req, res, next) => {
  const originHeader = req.headers.origin;
  const origin = typeof originHeader === 'string' ? originHeader : '';
  const allowOrigin = origin || DEFAULT_CORS_ORIGIN;
  const ok =
    !origin ||
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
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-csrf-token, x-mail-session');
    res.setHeader('Access-Control-Max-Age', '600');
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

const TWOFA_STEP_SECONDS = 30;
const TWOFA_WINDOW = 1;
const TWOFA_MAX_FAILED = Number(process.env.TWOFA_MAX_FAILED || 5);
const TWOFA_LOCKOUT_MS = Number(process.env.TWOFA_LOCKOUT_MS || 10 * 60 * 1000);
const PREAUTH_TTL_MS = Number(process.env.PREAUTH_TTL_MS || 5 * 60 * 1000);
const PREAUTH_JWT_SECRET = `${String(JWT_SECRET)}:preauth`;

const encryptToString = (plain) => JSON.stringify(encryptString(plain));
const decryptFromString = (cipherJson) => {
  const parsed = typeof cipherJson === 'string' ? JSON.parse(cipherJson) : null;
  if (!parsed || typeof parsed !== 'object') throw new Error('invalid_cipher');
  return decryptString(parsed);
};

const normalizeEmailKey = (email) => String(email || '').trim().toLowerCase();

const hashBackupCode = (code) => {
  const salt = crypto.randomBytes(16).toString('base64');
  const key = crypto.scryptSync(String(code), salt, 32);
  return { salt, hash: key.toString('base64') };
};
const verifyBackupCode = (code, entry) => {
  if (!entry || typeof entry !== 'object') return false;
  const salt = typeof entry.salt === 'string' ? entry.salt : '';
  const hash = typeof entry.hash === 'string' ? entry.hash : '';
  if (!salt || !hash) return false;
  try {
    const key = crypto.scryptSync(String(code), salt, 32).toString('base64');
    const a = Buffer.from(key, 'base64');
    const b = Buffer.from(hash, 'base64');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
};
const generateBackupCodes = (count = 10) => {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const raw = crypto.randomBytes(10).toString('base64').replace(/[^a-z0-9]/gi, '').toUpperCase();
    const code = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
    out.push(code);
  }
  return out;
};

const ensureAuthSchema = async () => {
  if (!db) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS arcmail_users (
      email TEXT PRIMARY KEY,
      encrypted_email_password TEXT,
      display_name TEXT,
      avatar_data_url TEXT,
      session_version INTEGER NOT NULL DEFAULT 0,
      twofa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      twofa_secret_enc TEXT,
      temp_twofa_secret_enc TEXT,
      backup_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
      failed_2fa_attempts INTEGER NOT NULL DEFAULT 0,
      lockout_until TIMESTAMPTZ,
      last_2fa_verified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await db.query(`ALTER TABLE arcmail_users ADD COLUMN IF NOT EXISTS display_name TEXT;`);
  await db.query(`ALTER TABLE arcmail_users ADD COLUMN IF NOT EXISTS avatar_data_url TEXT;`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_arcmail_users_twofa_enabled ON arcmail_users(twofa_enabled);`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS arcmail_admin_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS arcmail_audit_log (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      event_type TEXT NOT NULL,
      email TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      meta JSONB NOT NULL DEFAULT '{}'::jsonb
    );
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_arcmail_audit_log_email_created_at ON arcmail_audit_log(email, created_at DESC);`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS arcmail_email_ai (
      email TEXT NOT NULL,
      folder TEXT NOT NULL,
      uid BIGINT NOT NULL,
      message_id TEXT,
      content_hash TEXT NOT NULL,
      summary TEXT,
      label TEXT,
      priority INTEGER,
      extracted_data JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (email, folder, uid)
    );
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_arcmail_email_ai_email_priority ON arcmail_email_ai(email, priority DESC, updated_at DESC);`);
};

const dbGetUser = async (emailKey) => {
  if (!db) return null;
  const r = await db.query(
    `SELECT email, encrypted_email_password, display_name, avatar_data_url, session_version, twofa_enabled, twofa_secret_enc, temp_twofa_secret_enc, backup_codes, failed_2fa_attempts, lockout_until, last_2fa_verified_at
     FROM arcmail_users WHERE email = $1`,
    [emailKey]
  );
  return r.rows && r.rows[0] ? r.rows[0] : null;
};

const dbGetProfile = async (emailKey) => {
  if (!db) return null;
  const r = await db.query(`SELECT display_name, avatar_data_url FROM arcmail_users WHERE email = $1`, [emailKey]);
  if (!r.rows || !r.rows[0]) return null;
  const row = r.rows[0];
  return {
    displayName: typeof row.display_name === 'string' ? row.display_name : null,
    avatarDataUrl: typeof row.avatar_data_url === 'string' ? row.avatar_data_url : null,
  };
};

const dbSetProfile = async (emailKey, { displayName, avatarDataUrl }) => {
  if (!db) return false;
  await db.query(
    `INSERT INTO arcmail_users (email, display_name, avatar_data_url, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (email) DO UPDATE
     SET display_name = EXCLUDED.display_name,
         avatar_data_url = EXCLUDED.avatar_data_url,
         updated_at = now()`,
    [emailKey, displayName || null, avatarDataUrl || null]
  );
  return true;
};

const dbUpsertLoginPassword = async (emailKey, encPasswordObj) => {
  if (!db) return null;
  const encString = encPasswordObj ? JSON.stringify(encPasswordObj) : null;
  const r = await db.query(
    `INSERT INTO arcmail_users (email, encrypted_email_password, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (email) DO UPDATE
     SET encrypted_email_password = EXCLUDED.encrypted_email_password,
         updated_at = now()
     RETURNING email, encrypted_email_password, display_name, avatar_data_url, session_version, twofa_enabled, twofa_secret_enc, temp_twofa_secret_enc, backup_codes, failed_2fa_attempts, lockout_until, last_2fa_verified_at`,
    [emailKey, encString]
  );
  return r.rows && r.rows[0] ? r.rows[0] : null;
};

const dbSetTemp2faSecret = async (emailKey, tempEnc) => {
  if (!db) return false;
  await db.query(
    `UPDATE arcmail_users SET temp_twofa_secret_enc = $2, updated_at = now() WHERE email = $1`,
    [emailKey, tempEnc]
  );
  return true;
};

const dbEnable2fa = async ({ emailKey, secretEnc, backupCodesHashed, logoutAllSessions }) => {
  if (!db) return null;
  const bump = logoutAllSessions ? 1 : 0;
  const r = await db.query(
    `UPDATE arcmail_users
     SET twofa_enabled = TRUE,
         twofa_secret_enc = $2,
         temp_twofa_secret_enc = NULL,
         backup_codes = $3::jsonb,
         failed_2fa_attempts = 0,
         lockout_until = NULL,
         last_2fa_verified_at = now(),
         session_version = session_version + $4,
         updated_at = now()
     WHERE email = $1
     RETURNING session_version`,
    [emailKey, secretEnc, JSON.stringify(backupCodesHashed), bump]
  );
  return r.rows && r.rows[0] ? Number(r.rows[0].session_version || 0) : null;
};

const dbDisable2fa = async (emailKey) => {
  if (!db) return null;
  const r = await db.query(
    `UPDATE arcmail_users
     SET twofa_enabled = FALSE,
         twofa_secret_enc = NULL,
         temp_twofa_secret_enc = NULL,
         backup_codes = '[]'::jsonb,
         failed_2fa_attempts = 0,
         lockout_until = NULL,
         session_version = session_version + 1,
         updated_at = now()
     WHERE email = $1
     RETURNING session_version`,
    [emailKey]
  );
  return r.rows && r.rows[0] ? Number(r.rows[0].session_version || 0) : null;
};

const dbConsumeBackupCode = async (emailKey, code) => {
  if (!db) return { ok: false, used: false };
  const user = await dbGetUser(emailKey);
  if (!user) return { ok: false, used: false };
  const list = Array.isArray(user.backup_codes) ? user.backup_codes : [];
  let used = false;
  const remaining = [];
  for (const entry of list) {
    if (!used && verifyBackupCode(code, entry)) {
      used = true;
      continue;
    }
    remaining.push(entry);
  }
  if (!used) return { ok: true, used: false };
  await db.query(`UPDATE arcmail_users SET backup_codes = $2::jsonb, updated_at = now() WHERE email = $1`, [emailKey, JSON.stringify(remaining)]);
  return { ok: true, used: true };
};

const dbCheckSessionVersion = async (emailKey, tokenSv) => {
  if (!db) return true;
  const user = await dbGetUser(emailKey);
  if (!user) return true;
  const current = Number(user.session_version || 0);
  const sv = typeof tokenSv === 'number' && Number.isFinite(tokenSv) ? tokenSv : 0;
  return current === sv;
};

const dbRecord2faFailure = async (emailKey) => {
  if (!db) return { locked: false };
  const user = await dbGetUser(emailKey);
  if (!user) return { locked: false };
  const now = Date.now();
  const lockUntil = user.lockout_until ? new Date(user.lockout_until).getTime() : null;
  if (lockUntil && lockUntil > now) return { locked: true, until: lockUntil };
  const next = Number(user.failed_2fa_attempts || 0) + 1;
  if (next >= TWOFA_MAX_FAILED) {
    const until = new Date(now + TWOFA_LOCKOUT_MS).toISOString();
    await db.query(
      `UPDATE arcmail_users SET failed_2fa_attempts = 0, lockout_until = $2, updated_at = now() WHERE email = $1`,
      [emailKey, until]
    );
    return { locked: true, until: new Date(until).getTime() };
  }
  await db.query(`UPDATE arcmail_users SET failed_2fa_attempts = $2, updated_at = now() WHERE email = $1`, [emailKey, next]);
  return { locked: false };
};

const dbRecord2faSuccess = async (emailKey) => {
  if (!db) return;
  await db.query(
    `UPDATE arcmail_users SET failed_2fa_attempts = 0, lockout_until = NULL, last_2fa_verified_at = now(), updated_at = now() WHERE email = $1`,
    [emailKey]
  );
};

const AUTH_STORE_PATH = path.join(__dirname, 'arcmail-users.json');
const readAuthStore = () => {
  try {
    if (!fs.existsSync(AUTH_STORE_PATH)) return {};
    const raw = fs.readFileSync(AUTH_STORE_PATH, 'utf8');
    if (!raw || !raw.trim()) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
};
const writeAuthStore = (store) => {
  try {
    fs.writeFileSync(AUTH_STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
};
let authStore = readAuthStore();
const getAuthEntry = (emailKey) => {
  const store = authStore && typeof authStore === 'object' && !Array.isArray(authStore) ? authStore : {};
  const entry = store && typeof store === 'object' ? store[emailKey] : null;
  return entry && typeof entry === 'object' && !Array.isArray(entry) ? entry : null;
};
const setAuthEntry = (emailKey, entry) => {
  const store = authStore && typeof authStore === 'object' && !Array.isArray(authStore) ? authStore : {};
  const next = { ...store, [emailKey]: entry };
  authStore = next;
  return writeAuthStore(next);
};

const storeGetUser = async (emailKey) => {
  if (db) return await dbGetUser(emailKey);
  const entry = getAuthEntry(emailKey);
  if (!entry) return null;
  return {
    email: emailKey,
    encrypted_email_password: typeof entry.encrypted_email_password === 'string' ? entry.encrypted_email_password : null,
    session_version: typeof entry.session_version === 'number' ? entry.session_version : 0,
    twofa_enabled: Boolean(entry.twofa_enabled),
    twofa_secret_enc: typeof entry.twofa_secret_enc === 'string' ? entry.twofa_secret_enc : null,
    temp_twofa_secret_enc: typeof entry.temp_twofa_secret_enc === 'string' ? entry.temp_twofa_secret_enc : null,
    backup_codes: Array.isArray(entry.backup_codes) ? entry.backup_codes : [],
    failed_2fa_attempts: typeof entry.failed_2fa_attempts === 'number' ? entry.failed_2fa_attempts : 0,
    lockout_until: typeof entry.lockout_until === 'string' ? entry.lockout_until : null,
    last_2fa_verified_at: typeof entry.last_2fa_verified_at === 'string' ? entry.last_2fa_verified_at : null,
  };
};

const storeUpsertLoginPassword = async (emailKey, encPasswordObj) => {
  if (db) return await dbUpsertLoginPassword(emailKey, encPasswordObj);
  const prev = getAuthEntry(emailKey) || {};
  const encString = encPasswordObj ? JSON.stringify(encPasswordObj) : null;
  const next = {
    ...prev,
    encrypted_email_password: encString,
    session_version: typeof prev.session_version === 'number' ? prev.session_version : 0,
    twofa_enabled: Boolean(prev.twofa_enabled),
    twofa_secret_enc: typeof prev.twofa_secret_enc === 'string' ? prev.twofa_secret_enc : null,
    temp_twofa_secret_enc: typeof prev.temp_twofa_secret_enc === 'string' ? prev.temp_twofa_secret_enc : null,
    backup_codes: Array.isArray(prev.backup_codes) ? prev.backup_codes : [],
    failed_2fa_attempts: typeof prev.failed_2fa_attempts === 'number' ? prev.failed_2fa_attempts : 0,
    lockout_until: typeof prev.lockout_until === 'string' ? prev.lockout_until : null,
    last_2fa_verified_at: typeof prev.last_2fa_verified_at === 'string' ? prev.last_2fa_verified_at : null,
    updated_at: new Date().toISOString(),
  };
  setAuthEntry(emailKey, next);
  return await storeGetUser(emailKey);
};

const storeSetTemp2faSecret = async (emailKey, tempEnc) => {
  if (db) return await dbSetTemp2faSecret(emailKey, tempEnc);
  const prev = getAuthEntry(emailKey) || {};
  const next = { ...prev, temp_twofa_secret_enc: tempEnc, updated_at: new Date().toISOString() };
  return setAuthEntry(emailKey, next);
};

const storeEnable2fa = async ({ emailKey, secretEnc, backupCodesHashed, logoutAllSessions }) => {
  if (db) return await dbEnable2fa({ emailKey, secretEnc, backupCodesHashed, logoutAllSessions });
  const prev = getAuthEntry(emailKey) || {};
  const bump = logoutAllSessions ? 1 : 0;
  const currentSv = typeof prev.session_version === 'number' ? prev.session_version : 0;
  const nextSv = currentSv + bump;
  const next = {
    ...prev,
    twofa_enabled: true,
    twofa_secret_enc: secretEnc,
    temp_twofa_secret_enc: null,
    backup_codes: backupCodesHashed,
    failed_2fa_attempts: 0,
    lockout_until: null,
    last_2fa_verified_at: new Date().toISOString(),
    session_version: nextSv,
    updated_at: new Date().toISOString(),
  };
  setAuthEntry(emailKey, next);
  return nextSv;
};

const storeDisable2fa = async (emailKey) => {
  if (db) return await dbDisable2fa(emailKey);
  const prev = getAuthEntry(emailKey) || {};
  const currentSv = typeof prev.session_version === 'number' ? prev.session_version : 0;
  const nextSv = currentSv + 1;
  const next = {
    ...prev,
    twofa_enabled: false,
    twofa_secret_enc: null,
    temp_twofa_secret_enc: null,
    backup_codes: [],
    failed_2fa_attempts: 0,
    lockout_until: null,
    session_version: nextSv,
    updated_at: new Date().toISOString(),
  };
  setAuthEntry(emailKey, next);
  return nextSv;
};

const storeConsumeBackupCode = async (emailKey, code) => {
  if (db) return await dbConsumeBackupCode(emailKey, code);
  const user = await storeGetUser(emailKey);
  if (!user) return { ok: false, used: false };
  const list = Array.isArray(user.backup_codes) ? user.backup_codes : [];
  let used = false;
  const remaining = [];
  for (const entry of list) {
    if (!used && verifyBackupCode(code, entry)) {
      used = true;
      continue;
    }
    remaining.push(entry);
  }
  if (!used) return { ok: true, used: false };
  const prev = getAuthEntry(emailKey) || {};
  const next = { ...prev, backup_codes: remaining, updated_at: new Date().toISOString() };
  setAuthEntry(emailKey, next);
  return { ok: true, used: true };
};

const storeCheckSessionVersion = async (emailKey, tokenSv) => {
  if (db) return await dbCheckSessionVersion(emailKey, tokenSv);
  const user = await storeGetUser(emailKey);
  if (!user) return true;
  const current = Number(user.session_version || 0);
  const sv = typeof tokenSv === 'number' && Number.isFinite(tokenSv) ? tokenSv : 0;
  return current === sv;
};

const storeRecord2faFailure = async (emailKey) => {
  if (db) return await dbRecord2faFailure(emailKey);
  const user = await storeGetUser(emailKey);
  if (!user) return { locked: false };
  const now = Date.now();
  const lockUntil = user.lockout_until ? new Date(user.lockout_until).getTime() : null;
  if (lockUntil && lockUntil > now) return { locked: true, until: lockUntil };
  const nextAttempts = Number(user.failed_2fa_attempts || 0) + 1;
  if (nextAttempts >= TWOFA_MAX_FAILED) {
    const until = new Date(now + TWOFA_LOCKOUT_MS).toISOString();
    const prev = getAuthEntry(emailKey) || {};
    setAuthEntry(emailKey, { ...prev, failed_2fa_attempts: 0, lockout_until: until, updated_at: new Date().toISOString() });
    return { locked: true, until: new Date(until).getTime() };
  }
  const prev = getAuthEntry(emailKey) || {};
  setAuthEntry(emailKey, { ...prev, failed_2fa_attempts: nextAttempts, updated_at: new Date().toISOString() });
  return { locked: false };
};

const storeRecord2faSuccess = async (emailKey) => {
  if (db) return await dbRecord2faSuccess(emailKey);
  const prev = getAuthEntry(emailKey) || {};
  setAuthEntry(emailKey, {
    ...prev,
    failed_2fa_attempts: 0,
    lockout_until: null,
    last_2fa_verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
};

const ADMIN_STORE_PATH = path.join(__dirname, 'arcmail-admin.json');
const readAdminStore = () => {
  try {
    if (!fs.existsSync(ADMIN_STORE_PATH)) return {};
    const raw = fs.readFileSync(ADMIN_STORE_PATH, 'utf8');
    if (!raw || !raw.trim()) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
};
const writeAdminStore = (store) => {
  try {
    fs.writeFileSync(ADMIN_STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
};
let adminStore = readAdminStore();

const AUDIT_STORE_PATH = path.join(__dirname, 'arcmail-audit.json');
const readAuditStore = () => {
  try {
    if (!fs.existsSync(AUDIT_STORE_PATH)) return [];
    const raw = fs.readFileSync(AUDIT_STORE_PATH, 'utf8');
    if (!raw || !raw.trim()) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
const writeAuditStore = (rows) => {
  try {
    fs.writeFileSync(AUDIT_STORE_PATH, JSON.stringify(rows, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
};
let auditStore = readAuditStore();

const recordAuditEvent = async ({ eventType, email, ip, userAgent, meta }) => {
  const emailKey = normalizeEmailKey(email);
  if (!emailKey || !emailKey.includes('@')) return false;
  const safeMeta = meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {};
  if (db) {
    await db.query(
      `INSERT INTO arcmail_audit_log (event_type, email, ip, user_agent, meta)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [String(eventType || 'unknown'), emailKey, ip ? String(ip) : null, userAgent ? String(userAgent) : null, JSON.stringify(safeMeta)]
    );
    return true;
  }
  const row = {
    id: `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`,
    createdAt: new Date().toISOString(),
    eventType: String(eventType || 'unknown'),
    email: emailKey,
    ip: ip ? String(ip) : null,
    userAgent: userAgent ? String(userAgent) : null,
    meta: safeMeta,
  };
  const next = [row, ...(Array.isArray(auditStore) ? auditStore : [])].slice(0, 2000);
  auditStore = next;
  return writeAuditStore(next);
};

const listAuditEvents = async ({ email, limit, offset }) => {
  const lim = Math.min(500, Math.max(1, Number(limit || 100)));
  const off = Math.max(0, Number(offset || 0));
  const emailKey = email ? normalizeEmailKey(email) : '';
  if (db) {
    const r = await db.query(
      `SELECT id, created_at, event_type, email, ip, user_agent, meta
       FROM arcmail_audit_log
       WHERE ($1::text = '' OR email = $1)
       ORDER BY id DESC
       LIMIT $2 OFFSET $3`,
      [emailKey || '', lim, off]
    );
    const rows = (r.rows || []).map((row) => ({
      id: String(row.id),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
      eventType: String(row.event_type || ''),
      email: String(row.email || ''),
      ip: row.ip ? String(row.ip) : null,
      userAgent: row.user_agent ? String(row.user_agent) : null,
      meta: row.meta && typeof row.meta === 'object' ? row.meta : {},
    }));
    return rows;
  }
  const src = Array.isArray(auditStore) ? auditStore : [];
  const filtered = emailKey ? src.filter((r) => r && typeof r === 'object' && r.email === emailKey) : src;
  return filtered.slice(off, off + lim);
};

const dbGetAdminSetting = async (key) => {
  if (!db) return null;
  const r = await db.query(`SELECT value FROM arcmail_admin_settings WHERE key = $1`, [key]);
  return r.rows && r.rows[0] ? r.rows[0].value : null;
};
const dbSetAdminSetting = async (key, value) => {
  if (!db) return false;
  await db.query(
    `INSERT INTO arcmail_admin_settings (key, value, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, JSON.stringify(value)]
  );
  return true;
};

const getLoginBlock = async () => {
  if (db) {
    const v = await dbGetAdminSetting('loginBlock');
    const blocked = Boolean(v && typeof v === 'object' && v.blocked === true);
    const message = v && typeof v === 'object' && typeof v.message === 'string' ? v.message : '';
    return { blocked, message };
  }
  const store = adminStore && typeof adminStore === 'object' && !Array.isArray(adminStore) ? adminStore : {};
  const blocked = Boolean(store.loginBlocked);
  const message = typeof store.loginBlockMessage === 'string' ? store.loginBlockMessage : '';
  return { blocked, message };
};
const setLoginBlock = async ({ blocked, message }) => {
  const next = { blocked: Boolean(blocked), message: typeof message === 'string' ? message : '' };
  if (db) return await dbSetAdminSetting('loginBlock', next);
  const store = adminStore && typeof adminStore === 'object' && !Array.isArray(adminStore) ? adminStore : {};
  const updated = { ...store, loginBlocked: next.blocked, loginBlockMessage: next.message };
  adminStore = updated;
  return writeAdminStore(updated);
};

const normalizeDomain = (value) => {
  const d = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/\.+$/, '');
  if (!d) return '';
  if (d.includes('/') || d.includes(' ') || d.includes(':')) return '';
  if (!d.includes('.')) return '';
  return d;
};

const getDomainPolicy = async () => {
  const fallback = { domains: [{ domain: 'arcbyte.co', blocked: false }] };
  if (db) {
    const v = await dbGetAdminSetting('domainPolicy');
    const domains =
      v && typeof v === 'object' && Array.isArray(v.domains)
        ? v.domains
            .map((row) => {
              if (!row || typeof row !== 'object') return null;
              const domain = normalizeDomain(row.domain);
              if (!domain) return null;
              return { domain, blocked: row.blocked === true };
            })
            .filter(Boolean)
        : null;
    if (!domains || !domains.length) return fallback;
    const uniq = [];
    const seen = new Set();
    for (const r of domains) {
      if (seen.has(r.domain)) continue;
      seen.add(r.domain);
      uniq.push(r);
    }
    return { domains: uniq };
  }
  const store = adminStore && typeof adminStore === 'object' && !Array.isArray(adminStore) ? adminStore : {};
  const raw = store.domainPolicy;
  const domains =
    raw && typeof raw === 'object' && Array.isArray(raw.domains)
      ? raw.domains
          .map((row) => {
            if (!row || typeof row !== 'object') return null;
            const domain = normalizeDomain(row.domain);
            if (!domain) return null;
            return { domain, blocked: row.blocked === true };
          })
          .filter(Boolean)
      : null;
  if (!domains || !domains.length) return fallback;
  const uniq = [];
  const seen = new Set();
  for (const r of domains) {
    if (seen.has(r.domain)) continue;
    seen.add(r.domain);
    uniq.push(r);
  }
  return { domains: uniq };
};

const setDomainPolicy = async ({ domains }) => {
  const sanitized = Array.isArray(domains)
    ? domains
        .map((row) => {
          if (!row || typeof row !== 'object') return null;
          const domain = normalizeDomain(row.domain);
          if (!domain) return null;
          return { domain, blocked: row.blocked === true };
        })
        .filter(Boolean)
    : [];
  const uniq = [];
  const seen = new Set();
  for (const r of sanitized) {
    if (seen.has(r.domain)) continue;
    seen.add(r.domain);
    uniq.push(r);
  }
  const next = { domains: uniq };
  if (db) return await dbSetAdminSetting('domainPolicy', next);
  const store = adminStore && typeof adminStore === 'object' && !Array.isArray(adminStore) ? adminStore : {};
  const updated = { ...store, domainPolicy: next };
  adminStore = updated;
  return writeAdminStore(updated);
};

const checkDomainAllowed = async (emailKey) => {
  const email = String(emailKey || '').trim().toLowerCase();
  const parts = email.split('@');
  const domain = normalizeDomain(parts.length >= 2 ? parts[parts.length - 1] : '');
  if (!domain) return { ok: false, error: 'invalid_email_domain' };
  const policy = await getDomainPolicy();
  const match = policy.domains.find((d) => d.domain === domain) || null;
  if (!match) return { ok: false, error: 'domain_not_allowed', domain };
  if (match.blocked) return { ok: false, error: 'domain_blocked', domain };
  return { ok: true, domain };
};

const getEmailPolicy = async () => {
  const fallback = { emails: [] };
  if (db) {
    const v = await dbGetAdminSetting('emailPolicy');
    const emails =
      v && typeof v === 'object' && Array.isArray(v.emails)
        ? v.emails
            .map((row) => {
              if (!row || typeof row !== 'object') return null;
              const email = normalizeEmailKey(row.email);
              if (!email || !email.includes('@')) return null;
              return { email, blocked: row.blocked === true };
            })
            .filter(Boolean)
        : null;
    if (!emails || !emails.length) return fallback;
    const uniq = [];
    const seen = new Set();
    for (const r of emails) {
      if (seen.has(r.email)) continue;
      seen.add(r.email);
      uniq.push(r);
    }
    return { emails: uniq };
  }
  const store = adminStore && typeof adminStore === 'object' && !Array.isArray(adminStore) ? adminStore : {};
  const raw = store.emailPolicy;
  const emails =
    raw && typeof raw === 'object' && Array.isArray(raw.emails)
      ? raw.emails
          .map((row) => {
            if (!row || typeof row !== 'object') return null;
            const email = normalizeEmailKey(row.email);
            if (!email || !email.includes('@')) return null;
            return { email, blocked: row.blocked === true };
          })
          .filter(Boolean)
      : null;
  if (!emails || !emails.length) return fallback;
  const uniq = [];
  const seen = new Set();
  for (const r of emails) {
    if (seen.has(r.email)) continue;
    seen.add(r.email);
    uniq.push(r);
  }
  return { emails: uniq };
};

const setEmailPolicy = async ({ emails }) => {
  const sanitized = Array.isArray(emails)
    ? emails
        .map((row) => {
          if (!row || typeof row !== 'object') return null;
          const email = normalizeEmailKey(row.email);
          if (!email || !email.includes('@')) return null;
          return { email, blocked: row.blocked === true };
        })
        .filter(Boolean)
    : [];
  const uniq = [];
  const seen = new Set();
  for (const r of sanitized) {
    if (seen.has(r.email)) continue;
    seen.add(r.email);
    uniq.push(r);
  }
  const next = { emails: uniq };
  if (db) return await dbSetAdminSetting('emailPolicy', next);
  const store = adminStore && typeof adminStore === 'object' && !Array.isArray(adminStore) ? adminStore : {};
  const updated = { ...store, emailPolicy: next };
  adminStore = updated;
  return writeAdminStore(updated);
};

const checkEmailAllowed = async (emailKey) => {
  const email = normalizeEmailKey(emailKey);
  if (!email || !email.includes('@')) return { ok: false, error: 'invalid_email' };
  const policy = await getEmailPolicy();
  const match = policy.emails.find((e) => e.email === email) || null;
  if (!match) return { ok: true };
  if (match.blocked) return { ok: false, error: 'email_blocked' };
  return { ok: true };
};

const normalizeAdminString = (v) => String(v || '').trim();
const timingSafeEq = (a, b) => {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
};
const signAdminToken = ({ username }) => {
  const ttl = typeof ADMIN_SESSION_TTL_MS === 'number' && Number.isFinite(ADMIN_SESSION_TTL_MS) ? ADMIN_SESSION_TTL_MS : 12 * 60 * 60 * 1000;
  return jwt.sign({ role: 'ADMIN', username }, ADMIN_JWT_SECRET, { expiresIn: Math.floor(ttl / 1000) });
};
const parseAdminAuth = (req) => {
  const raw = req.headers.authorization || '';
  const [kind, token] = String(raw).split(' ');
  if (kind !== 'Bearer' || !token) return null;
  try {
    const payload = jwt.verify(token, ADMIN_JWT_SECRET);
    if (!payload || typeof payload !== 'object') return null;
    const decoded = payload;
    if (decoded.role !== 'ADMIN') return null;
    const username = typeof decoded.username === 'string' ? decoded.username : null;
    if (!username) return null;
    return { username };
  } catch {
    return null;
  }
};
const requireAdmin = (req, res, next) => {
  const a = parseAdminAuth(req);
  if (!a) return res.status(401).json({ error: 'unauthorized' });
  req.admin = a;
  return next();
};

const isMobileUserAgent = (req) => {
  const ua = String(req.headers['user-agent'] || '');
  return /android|iphone|ipod|ipad|iemobile|blackberry|opera mini|mobile/i.test(ua);
};

const enforceAdminDesktopOnly = (req, res) => {
  if (isMobileUserAgent(req)) {
    res.status(403).json({ error: 'admin_desktop_only', message: 'Admin is available on desktop only.' });
    return false;
  }
  return true;
};

const sessions = new Map();
const attachmentCache = new Map();
const forgotPasswordRate = new Map();
const pushStateByEmail = new Map();
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
setInterval(async () => {
  if (!PUSH_ENABLED) return;
  const now = nowMs();
  const targets = Array.from(pushStateByEmail.entries());
  if (targets.length === 0) return;

  const sendToSubs = async (subs, payload) => {
    const body = JSON.stringify(payload);
    for (const [endpoint, sub] of subs.entries()) {
      try {
        await webpush.sendNotification(sub, body, { TTL: 120 });
      } catch (err) {
        const statusCode =
          err && typeof err === 'object' && 'statusCode' in err && typeof err.statusCode === 'number'
            ? err.statusCode
            : null;
        if (statusCode === 404 || statusCode === 410) {
          subs.delete(endpoint);
        }
      }
    }
  };

  for (const [emailKey, entry] of targets) {
    if (!entry || typeof entry !== 'object') {
      pushStateByEmail.delete(emailKey);
      continue;
    }
    const subs = entry.subs instanceof Map ? entry.subs : null;
    if (!subs || subs.size === 0) {
      pushStateByEmail.delete(emailKey);
      continue;
    }
    if (!entry.encPassword) continue;
    if (typeof entry.lastCheckedAt === 'number' && now - entry.lastCheckedAt < 7000) continue;
    entry.lastCheckedAt = now;

    let password = '';
    try {
      password = decryptString(entry.encPassword);
    } catch {
      continue;
    }

    let unseen = null;
    try {
      const loginEmail = typeof entry.email === 'string' && entry.email.trim() ? entry.email.trim() : emailKey;
      unseen = await withImap({ email: loginEmail, password, folder: 'INBOX' }, async (client) => {
        try {
          const s = await client.status('INBOX', { unseen: true });
          return Number(s.unseen || 0);
        } catch {
          return 0;
        }
      });
    } catch {
      continue;
    }

    if (!Number.isFinite(unseen)) continue;
    const prev = typeof entry.lastUnseen === 'number' ? entry.lastUnseen : null;
    entry.lastUnseen = unseen;
    if (prev === null) continue;
    if (unseen <= prev) continue;
    const diff = unseen - prev;

    await sendToSubs(subs, {
      title: 'New mail',
      body: diff > 1 ? `+${diff} new in Inbox` : '1 new in Inbox',
      url: '/',
      tag: 'arcmail-inbox',
    });

    if (subs.size === 0) pushStateByEmail.delete(emailKey);
  }
}, 10_000);
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

const signToken = ({ sessionId, email, ttlMs, encPassword, csrfToken, sessionVersion, twoFactorVerified }) => {
  const ttl = typeof ttlMs === 'number' && Number.isFinite(ttlMs) ? ttlMs : SESSION_TTL_MS;
  return jwt.sign(
    {
      role: 'MAIL_USER',
      email,
      ep: encPassword,
      csrf: csrfToken,
      sv: typeof sessionVersion === 'number' ? sessionVersion : 0,
      tfa: twoFactorVerified ? 1 : 0,
    },
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
    const sessionVersion = typeof decoded.sv === 'number' && Number.isFinite(decoded.sv) ? decoded.sv : 0;
    const twoFactorVerified = decoded.tfa === 1;
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
    return { sessionId, email, role, encPassword, csrfToken, sessionVersion, twoFactorVerified };
  } catch {
    return null;
  }
};

const requireAuth = async (req, res, next) => {
  const auth = parseAuth(req);
  if (!auth) return res.status(401).json({ error: 'unauthorized' });
  if (REQUIRE_2FA_ON_LOGIN && !auth.twoFactorVerified) return res.status(401).json({ error: 'twofa_required' });
  const emailKey = normalizeEmailKey(auth.email);
  const svOk = await storeCheckSessionVersion(emailKey, auth.sessionVersion);
  if (!svOk) return res.status(401).json({ error: 'session_revoked' });
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
    buildId: SERVER_BUILD_ID,
    auth: {
      require2FAOnLogin: REQUIRE_2FA_ON_LOGIN,
      storage: db ? 'db' : 'file',
      nodeEnv: process.env.NODE_ENV || 'development',
    },
  })
);

app.get('/api/dev/routes', (req, res) => {
  if (IS_PROD) return res.status(404).json({ error: 'not_found' });
  const host = String(req.hostname || '').toLowerCase();
  const ip = String(req.ip || '').toLowerCase();
  const isLocal = host === 'localhost' || host === '127.0.0.1' || ip.includes('127.0.0.1') || ip.includes('::1');
  if (!isLocal) return res.status(401).json({ error: 'unauthorized' });
  try {
    const stack = app && app._router && Array.isArray(app._router.stack) ? app._router.stack : [];
    const routes = [];
    for (const layer of stack) {
      if (!layer) continue;
      if (layer.route && layer.route.path) {
        const methods = layer.route.methods ? Object.keys(layer.route.methods).filter((m) => layer.route.methods[m]) : [];
        routes.push({ path: layer.route.path, methods });
      }
    }
    return res.json({ ok: true, count: routes.length, routes });
  } catch (e) {
    const msg = e && typeof e === 'object' && 'message' in e && typeof e.message === 'string' ? e.message : 'failed';
    return res.status(500).json({ error: 'server_error', message: msg });
  }
});

app.get('/api/dev/ai/ping', async (req, res) => {
  if (IS_PROD) return res.status(404).json({ error: 'not_found' });
  const host = String(req.hostname || '').toLowerCase();
  const ip = String(req.ip || '').toLowerCase();
  const isLocal = host === 'localhost' || host === '127.0.0.1' || ip.includes('127.0.0.1') || ip.includes('::1');
  if (!isLocal) return res.status(401).json({ error: 'unauthorized' });
  try {
    const out = await runAI('Say OK', { maxTokens: 12, temperature: 0, model: 'llama-3.1-8b-instant' });
    return res.json({ ok: true, out });
  } catch (err) {
    const status = err && typeof err === 'object' && typeof err.status === 'number' ? err.status : null;
    const code = err && typeof err === 'object' && typeof err.code === 'string' ? String(err.code) : null;
    const model = err && typeof err === 'object' && typeof err.model === 'string' ? String(err.model) : null;
    const message = err && typeof err === 'object' && typeof err.message === 'string' ? String(err.message) : 'error';
    return res.status(500).json({ ok: false, status, code, model, message: message.slice(0, 240) });
  }
});

app.get('/api/notifications/vapid-public-key', (_req, res) => {
  if (!PUSH_ENABLED || !VAPID_PUBLIC_KEY) return res.status(501).json({ error: 'push_unconfigured' });
  return res.json({ publicKey: VAPID_PUBLIC_KEY });
});

const adminLoginRate = new Map();
const rateLimitAdminLogin = (key) => {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const max = 10;
  const prev = adminLoginRate.get(key);
  const entry = prev && typeof prev === 'object' ? prev : { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }
  entry.count += 1;
  adminLoginRate.set(key, entry);
  return entry.count <= max;
};

app.post('/api/admin/login', express.json({ limit: '50kb' }), async (req, res) => {
  if (!enforceAdminDesktopOnly(req, res)) return;
  const ip = String(req.ip || 'unknown');
  if (!rateLimitAdminLogin(ip)) return res.status(429).json({ error: 'rate_limited' });
  const username = normalizeAdminString(req.body?.username);
  const password = String(req.body?.password || '');
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) return res.status(501).json({ error: 'admin_unconfigured' });
  const okUser = timingSafeEq(username, ADMIN_USERNAME);
  const okPass = timingSafeEq(password, ADMIN_PASSWORD);
  if (!okUser || !okPass) return res.status(401).json({ error: 'invalid_credentials' });
  const token = signAdminToken({ username });
  return res.json({ ok: true, token, user: { username, role: 'ADMIN' } });
});

app.get('/api/admin/me', requireAdmin, (req, res) => {
  if (!enforceAdminDesktopOnly(req, res)) return;
  return res.json({ ok: true, user: { username: req.admin.username, role: 'ADMIN' } });
});

app.get('/api/admin/login-block', requireAdmin, async (_req, res) => {
  if (!enforceAdminDesktopOnly(_req, res)) return;
  const v = await getLoginBlock();
  return res.json({ ok: true, blocked: v.blocked, message: v.message || '' });
});

app.post('/api/admin/login-block', requireAdmin, express.json({ limit: '50kb' }), async (req, res) => {
  if (!enforceAdminDesktopOnly(req, res)) return;
  try {
    const blocked = Boolean(req.body?.blocked);
    const message = typeof req.body?.message === 'string' ? req.body.message : '';
    const ok = await setLoginBlock({ blocked, message });
    if (!ok) return res.status(500).json({ error: 'save_failed', message: 'Failed to save login block settings.' });
    return res.json({ ok: true, blocked, message });
  } catch {
    return res.status(500).json({ error: 'save_failed', message: 'Failed to save login block settings.' });
  }
});

app.get('/api/admin/domain-policy', requireAdmin, async (_req, res) => {
  if (!enforceAdminDesktopOnly(_req, res)) return;
  const policy = await getDomainPolicy();
  return res.json({ ok: true, domains: policy.domains });
});

app.post('/api/admin/domain-policy', requireAdmin, express.json({ limit: '50kb' }), async (req, res) => {
  if (!enforceAdminDesktopOnly(req, res)) return;
  try {
    const domains = Array.isArray(req.body?.domains) ? req.body.domains : [];
    const ok = await setDomainPolicy({ domains });
    if (!ok) return res.status(500).json({ error: 'save_failed', message: 'Failed to save domain rules.' });
    const policy = await getDomainPolicy();
    return res.json({ ok: true, domains: policy.domains });
  } catch {
    return res.status(500).json({ error: 'save_failed', message: 'Failed to save domain rules.' });
  }
});

app.get('/api/admin/email-policy', requireAdmin, async (_req, res) => {
  if (!enforceAdminDesktopOnly(_req, res)) return;
  const policy = await getEmailPolicy();
  return res.json({ ok: true, emails: policy.emails });
});

app.post('/api/admin/email-policy', requireAdmin, express.json({ limit: '50kb' }), async (req, res) => {
  if (!enforceAdminDesktopOnly(req, res)) return;
  try {
    const emails = Array.isArray(req.body?.emails) ? req.body.emails : [];
    const ok = await setEmailPolicy({ emails });
    if (!ok) return res.status(500).json({ error: 'save_failed', message: 'Failed to save email rules.' });
    const policy = await getEmailPolicy();
    return res.json({ ok: true, emails: policy.emails });
  } catch {
    return res.status(500).json({ error: 'save_failed', message: 'Failed to save email rules.' });
  }
});

app.post('/api/admin/send-access-email', requireAdmin, express.json({ limit: '50kb' }), async (req, res) => {
  if (!enforceAdminDesktopOnly(req, res)) return;
  const arcMailEmail = normalizeEmailKey(req.body?.arcMailEmail);
  const toEmail = String(req.body?.toEmail || '').trim().toLowerCase();
  const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
  const includePassword = Boolean(req.body?.includePassword);
  const plainPassword = typeof req.body?.password === 'string' ? req.body.password : '';

  const isValidEmail = (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  if (!arcMailEmail || !arcMailEmail.includes('@')) return res.status(400).json({ error: 'invalid_arcmail_email', message: 'Invalid ArcMail email.' });
  if (!isValidEmail(toEmail)) return res.status(400).json({ error: 'invalid_to_email', message: 'Invalid delivery email.' });
  if (includePassword) {
    if (!ADMIN_ALLOW_PASSWORD_EMAIL) return res.status(403).json({ error: 'password_email_disabled', message: 'Password delivery via email is disabled.' });
    if (!plainPassword) return res.status(400).json({ error: 'missing_password', message: 'Password is required when password delivery is enabled.' });
  }

  try {
    const emailCheck = await checkEmailAllowed(arcMailEmail);
    if (!emailCheck.ok) return res.status(403).json({ error: 'email_blocked', message: 'This mailbox is blocked.' });
    const domainCheck = await checkDomainAllowed(arcMailEmail);
    if (!domainCheck.ok) return res.status(403).json({ error: 'domain_blocked', message: 'This mailbox domain is not allowed.' });
  } catch {
  }

  const host = process.env.ADMIN_NOTIFY_SMTP_HOST || process.env.FORGOT_SMTP_HOST || SMTP_HOST;
  const port = Number(process.env.ADMIN_NOTIFY_SMTP_PORT || process.env.FORGOT_SMTP_PORT || SMTP_PORT || 465);
  const user =
    typeof process.env.ADMIN_NOTIFY_SMTP_USER === 'string' && process.env.ADMIN_NOTIFY_SMTP_USER
      ? process.env.ADMIN_NOTIFY_SMTP_USER
      : typeof process.env.FORGOT_SMTP_USER === 'string'
        ? process.env.FORGOT_SMTP_USER
        : '';
  const pass =
    typeof process.env.ADMIN_NOTIFY_SMTP_PASS === 'string' && process.env.ADMIN_NOTIFY_SMTP_PASS
      ? process.env.ADMIN_NOTIFY_SMTP_PASS
      : typeof process.env.FORGOT_SMTP_PASS === 'string'
        ? process.env.FORGOT_SMTP_PASS
        : '';
  const from = process.env.ADMIN_NOTIFY_SMTP_FROM || process.env.FORGOT_SMTP_FROM || user || 'sysadmin@mail.arcbyte.co';

  if (!user || !pass) {
    return res.status(501).json({
      error: 'admin_email_unconfigured',
      message: 'Admin email is not configured on the backend.',
    });
  }

  const escapeHtml = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (ch) => {
      if (ch === '&') return '&amp;';
      if (ch === '<') return '&lt;';
      if (ch === '>') return '&gt;';
      if (ch === '"') return '&quot;';
      return '&#39;';
    });

  const logoDataUri = getArcbyteLogoDataUri();
  const loginUrl = process.env.ARCMAIL_LOGIN_URL || 'https://mail.arcbyte.co/login';
  const subject = `Your ArcMail access — ${arcMailEmail}`;
  const recipient = fullName ? `${fullName} <${toEmail}>` : toEmail;
  const text = [
    'ArcMail access',
    '',
    `Username: ${arcMailEmail}`,
    ...(includePassword ? [`Password: ${plainPassword}`] : []),
    `Login: ${loginUrl}`,
    '',
    ...(includePassword
      ? [
          'If you suspect exposure, change the password in your mailbox provider immediately.',
        ]
      : [
          'For security, passwords are not sent over email.',
          'If you need a password reset, contact your administrator or IT support.',
        ]),
    '',
    'Enable 2FA (Google Authenticator):',
    '- Install Google Authenticator',
    '- Scan the QR code during setup in ArcMail',
    '- Save your backup codes in a password manager',
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
      body { margin:0 !important; padding:0 !important; }
      .font { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Inter, Roboto, Helvetica, Arial, sans-serif; }
      .bg { background:#0A0A0A !important; }
      .card { background:#0B0B0B !important; border:1px solid rgba(255,255,255,0.10) !important; }
      .muted { color:rgba(255,255,255,0.62) !important; }
      .soft { color:rgba(255,255,255,0.72) !important; }
      .label { color:rgba(255,255,255,0.50) !important; }
      .value { color:#FFFFFF !important; }
      .chip { background:#111111 !important; border:1px solid rgba(255,255,255,0.08) !important; border-radius:18px; padding:16px 16px; }
      .divider { height:1px; background:rgba(255,255,255,0.10); }
      .btn { background:#1DB954 !important; color:#06130B !important; text-decoration:none !important; display:inline-block; padding:14px 18px; border-radius:16px; font-weight:900; letter-spacing:0.14em; text-transform:uppercase; font-size:12px; }
      .pill { display:inline-block; padding:6px 10px; border-radius:999px; background:rgba(29,185,84,0.12); border:1px solid rgba(29,185,84,0.22); color:#B8F7CF; font-size:11px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; }
      .stepN { width:26px; height:26px; border-radius:10px; background:rgba(29,185,84,0.16); border:1px solid rgba(29,185,84,0.24); color:#B8F7CF; font-weight:900; font-size:12px; line-height:26px; text-align:center; }
      @media (prefers-color-scheme: light) {
        .bg { background:#F4F5F7 !important; }
        .card { background:#FFFFFF !important; border:1px solid rgba(0,0,0,0.12) !important; }
        .muted { color:rgba(0,0,0,0.62) !important; }
        .soft { color:rgba(0,0,0,0.72) !important; }
        .label { color:rgba(0,0,0,0.52) !important; }
        .value { color:#0B0B0B !important; }
        .chip { background:#F7F8FA !important; border:1px solid rgba(0,0,0,0.08) !important; }
        .divider { background:rgba(0,0,0,0.10); }
        .pill { background:rgba(29,185,84,0.10); border:1px solid rgba(29,185,84,0.22); color:#0E5A2B; }
        .btn { background:#1DB954 !important; color:#06130B !important; }
        .stepN { background:rgba(29,185,84,0.12); border:1px solid rgba(29,185,84,0.24); color:#0E5A2B; }
      }
    </style>
  </head>
  <body class="font bg">
    <table role="presentation" class="bg font" cellpadding="0" cellspacing="0" border="0" width="100%" style="padding:34px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:680px;">
            <tr>
              <td class="card" style="border-radius:26px; overflow:hidden;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td style="padding:0;">
                      <div style="height:4px;background:linear-gradient(90deg,#0A0A0A 0%, #1DB954 35%, #1ED760 65%, #0A0A0A 100%);"></div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:24px 24px 10px 24px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr>
                          <td style="width:44px; vertical-align:top;">
                            <div style="width:44px;height:44px;border-radius:16px;background:#0B0B0B;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,0.10);">
                              ${logoDataUri ? `<img src="${logoDataUri}" alt="ArcByte" width="22" height="22" style="display:block;width:22px;height:22px;object-fit:contain;" />` : `<span style="font-weight:900;color:#FFFFFF;font-size:12px;letter-spacing:0.08em;">ARC</span>`}
                            </div>
                          </td>
                          <td style="padding-left:14px; vertical-align:top;">
                            <div class="pill">ArcMail Access</div>
                            <div class="value" style="margin-top:10px;font-size:22px;font-weight:950;letter-spacing:-0.03em;line-height:1.2;">
                              ${fullName ? `Welcome, ${escapeHtml(fullName)}.` : 'Welcome.'}
                            </div>
                            <div class="muted" style="margin-top:8px;font-size:14px;line-height:1.6;">
                              Your ArcMail account is ready. Use the details below to sign in.
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:14px 24px 0 24px;">
                      <div class="divider"></div>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:18px 24px 0 24px;">
                      <div class="label" style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;">Credentials</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 24px 0 24px;">
                      <div class="chip">
                        <div class="label" style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;">Username</div>
                        <div class="value" style="margin-top:10px;font-size:16px;font-weight:900;word-break:break-word;">${escapeHtml(arcMailEmail)}</div>
                        ${includePassword ? `<div style="height:12px;"></div>
                        <div class="label" style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;">Password</div>
                        <div class="value" style="margin-top:10px;font-size:16px;font-weight:900;word-break:break-word;">${escapeHtml(plainPassword)}</div>` : ''}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:18px 24px 6px 24px;">
                      <a class="btn" href="${escapeHtml(loginUrl)}" target="_blank" rel="noreferrer">Sign in</a>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:10px 24px 0 24px;">
                      <div class="muted" style="font-size:13px;line-height:1.65;">
                        ${includePassword ? 'If you suspect exposure, change the password in your mailbox provider immediately.' : 'If you need a password reset, contact your administrator / IT support.'}
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:18px 24px 0 24px;">
                      <div class="divider"></div>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:18px 24px 0 24px;">
                      <div class="label" style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;">Set up 2FA</div>
                      <div class="soft" style="margin-top:8px;font-size:14px;line-height:1.6;">
                        Recommended: enable two-factor authentication using Google Authenticator and save your backup codes.
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 24px 0 24px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="chip" style="border-radius:18px;">
                        <tr>
                          <td style="padding:14px 16px;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                              <tr>
                                <td style="width:30px; vertical-align:top;"><div class="stepN">1</div></td>
                                <td style="padding-left:12px;" class="soft">Install Google Authenticator (App Store / Play Store).</td>
                              </tr>
                              <tr><td style="height:12px;"></td><td></td></tr>
                              <tr>
                                <td style="width:30px; vertical-align:top;"><div class="stepN">2</div></td>
                                <td style="padding-left:12px;" class="soft">In ArcMail, enable 2FA and scan the QR code in the app.</td>
                              </tr>
                              <tr><td style="height:12px;"></td><td></td></tr>
                              <tr>
                                <td style="width:30px; vertical-align:top;"><div class="stepN">3</div></td>
                                <td style="padding-left:12px;" class="soft">Download and store your backup codes in a password manager.</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:18px 24px 22px 24px;">
                      <div class="muted" style="font-size:12px;line-height:1.6;">
                        Sent by ArcMail Admin · ${escapeHtml(from)}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="muted" style="padding:14px 2px 0 2px;font-size:12px;line-height:1.55;">
                If you did not expect this email, you can ignore it.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    await transporter.sendMail({ from, to: recipient, subject, text, html });
    return res.json({ ok: true });
  } catch {
    return res.status(502).json({ error: 'smtp_error', message: 'Failed to send email.' });
  }
});

app.get('/api/admin/activity', requireAdmin, async (req, res) => {
  if (!enforceAdminDesktopOnly(req, res)) return;
  const email = typeof req.query?.email === 'string' ? req.query.email : '';
  const limit = typeof req.query?.limit === 'string' ? Number(req.query.limit) : 100;
  const offset = typeof req.query?.offset === 'string' ? Number(req.query.offset) : 0;
  const rows = await listAuditEvents({ email, limit, offset });
  return res.json({ ok: true, events: rows });
});

app.get('/api/admin/users', requireAdmin, async (_req, res) => {
  if (!enforceAdminDesktopOnly(_req, res)) return;
  if (db) {
    const r = await db.query(
      `SELECT email, twofa_enabled, updated_at FROM arcmail_users ORDER BY updated_at DESC NULLS LAST LIMIT 500`
    );
    const users = (r.rows || []).map((row) => ({
      email: String(row.email || ''),
      twofaEnabled: Boolean(row.twofa_enabled),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    }));
    return res.json({ ok: true, users });
  }
  const store = authStore && typeof authStore === 'object' && !Array.isArray(authStore) ? authStore : {};
  const users = Object.keys(store)
    .sort()
    .slice(0, 500)
    .map((email) => {
      const entry = store[email] && typeof store[email] === 'object' ? store[email] : {};
      const enabled = Boolean(entry.twofa_enabled);
      const updatedAt = typeof entry.updated_at === 'string' ? entry.updated_at : null;
      return { email, twofaEnabled: enabled, updatedAt };
    });
  return res.json({ ok: true, users });
});

const reset2faForEmail = async (emailKey) => {
  if (db) {
    const r = await db.query(
      `UPDATE arcmail_users
       SET twofa_enabled = FALSE,
           twofa_secret_enc = NULL,
           temp_twofa_secret_enc = NULL,
           backup_codes = '[]'::jsonb,
           failed_2fa_attempts = 0,
           lockout_until = NULL,
           last_2fa_verified_at = NULL,
           session_version = session_version + 1,
           updated_at = now()
       WHERE email = $1`,
      [emailKey]
    );
    return { ok: true, existed: (r.rowCount || 0) > 0 };
  }
  const prev = getAuthEntry(emailKey);
  const currentSv = prev && typeof prev.session_version === 'number' ? prev.session_version : 0;
  const next = {
    ...(prev || {}),
    twofa_enabled: false,
    twofa_secret_enc: null,
    temp_twofa_secret_enc: null,
    backup_codes: [],
    failed_2fa_attempts: 0,
    lockout_until: null,
    last_2fa_verified_at: null,
    session_version: currentSv + 1,
    updated_at: new Date().toISOString(),
  };
  setAuthEntry(emailKey, next);
  return { ok: true, existed: Boolean(prev) };
};

app.post('/api/admin/reset-2fa-email', requireAdmin, express.json({ limit: '50kb' }), async (req, res) => {
  if (!enforceAdminDesktopOnly(req, res)) return;
  const email = normalizeEmailKey(req.body?.email);
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'invalid_email' });
  const r = await reset2faForEmail(email);
  return res.json({ ok: true, ...r });
});

app.post('/api/admin/reset-2fa-all', requireAdmin, async (_req, res) => {
  if (!enforceAdminDesktopOnly(_req, res)) return;
  const r = await resetAll2fa();
  return res.json({ ok: true, ...r });
});

app.post('/api/admin/bootstrap', requireAdmin, async (_req, res) => {
  if (!enforceAdminDesktopOnly(_req, res)) return;
  if (!db) return res.status(501).json({ error: 'db_unconfigured' });
  await ensureAuthSchema();
  const r = await db.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename ASC`);
  const tables = (r.rows || []).map((row) => String(row.tablename || '')).filter(Boolean);
  return res.json({ ok: true, tables });
});

app.post('/api/login', (_req, res) => res.status(404).json({ error: 'use_/api/auth/login' }));
app.get('/api/login', (_req, res) => res.status(405).json({ error: 'method_not_allowed' }));
app.get('/api/auth/mail-login', (_req, res) => res.status(405).json({ error: 'method_not_allowed' }));
app.get('/api/auth/login', (_req, res) => res.status(405).json({ error: 'method_not_allowed' }));

const finishLogin = async ({ email, encPassword, csrfToken, sessionId, ttlMs, sessionVersion, twoFactorVerified, ip, userAgent }) => {
  const createdAt = nowMs();
  sessions.set(sessionId, {
    id: sessionId,
    email,
    encPassword,
    csrfToken,
    createdAt,
    lastUsedAt: createdAt,
    ttlMs,
  });
  const token = signToken({ sessionId, email, ttlMs, encPassword, csrfToken, sessionVersion, twoFactorVerified });
  const name = email.split('@')[0] || email;
  try {
    await recordAuditEvent({
      eventType: 'login',
      email,
      ip,
      userAgent,
      meta: { twoFactorVerified: Boolean(twoFactorVerified), sessionId },
    });
  } catch {
  }
  return { token, csrfToken, sessionId, user: { name, email, role: 'MAIL_USER', status: 'Active' } };
};

const handleAuthLogin = async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const rememberMe = Boolean(req.body?.rememberMe);

  if (!email || !password) return res.status(400).json({ error: 'missing_credentials' });
  if (!email.includes('@')) return res.status(400).json({ error: 'invalid_email' });

  try {
    const block = await getLoginBlock();
    if (block.blocked) return res.status(403).json({ error: 'login_blocked', message: block.message || undefined });
  } catch {
  }

  try {
    const emailKey = normalizeEmailKey(email);
    const emailCheck = await checkEmailAllowed(emailKey);
    if (!emailCheck.ok) return res.status(403).json({ error: 'email_blocked', message: 'Sign-in for this email is blocked.' });
  } catch {
  }

  try {
    const domainCheck = await checkDomainAllowed(normalizeEmailKey(email));
    if (!domainCheck.ok) {
      const msg =
        domainCheck.error === 'domain_blocked'
          ? `Sign-ins from @${domainCheck.domain} are blocked.`
          : domainCheck.error === 'domain_not_allowed'
            ? `Sign-ins from @${domainCheck.domain} are not allowed.`
            : 'Sign-in domain is not allowed.';
      return res.status(403).json({ error: 'domain_blocked', message: msg });
    }
  } catch {
  }

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
  const encPassword = encryptString(password);
  const emailKey = normalizeEmailKey(email);
  const userRow = await storeUpsertLoginPassword(emailKey, encPassword);
  const twofaEnabled = Boolean(userRow && userRow.twofa_enabled);
  const sessionVersion = userRow ? Number(userRow.session_version || 0) : 0;

  if (twofaEnabled) {
    const sessionId = crypto.randomUUID();
    const csrfToken = crypto.randomBytes(32).toString('hex');
    const preAuthToken = jwt.sign(
      { role: 'PREAUTH', email, ep: encPassword, csrf: csrfToken, sv: sessionVersion, rm: rememberMe ? 1 : 0, ttl: ttlMs },
      PREAUTH_JWT_SECRET,
      { subject: sessionId, expiresIn: Math.floor(PREAUTH_TTL_MS / 1000) }
    );
    return res.json({ ok: true, require2FA: true, preAuthToken, user: { email, role: 'MAIL_USER' } });
  }

  if (!REQUIRE_2FA_ON_LOGIN) {
    const sessionId = crypto.randomUUID();
    const csrfToken = crypto.randomBytes(32).toString('hex');
    const result = await finishLogin({
      email,
      encPassword,
      csrfToken,
      sessionId,
      ttlMs,
      sessionVersion,
      twoFactorVerified: false,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return res.json(result);
  }

  const sessionId = crypto.randomUUID();
  const csrfToken = crypto.randomBytes(32).toString('hex');
  const preAuthToken = jwt.sign(
    { role: 'PREAUTH_SETUP', email, ep: encPassword, csrf: csrfToken, sv: sessionVersion, rm: rememberMe ? 1 : 0, ttl: ttlMs },
    PREAUTH_JWT_SECRET,
    { subject: sessionId, expiresIn: Math.floor(PREAUTH_TTL_MS / 1000) }
  );

  const secret = speakeasy.generateSecret({ length: 20, name: `ArcMail:${email}`, issuer: 'ArcMail' });
  const tempEnc = encryptToString(secret.base32);
  await storeSetTemp2faSecret(emailKey, tempEnc);
  const otpauthUrl = typeof secret.otpauth_url === 'string' ? secret.otpauth_url : '';
  if (!otpauthUrl) return res.status(500).json({ error: 'twofa_setup_failed' });
  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, scale: 6 });
  } catch {
    return res.status(500).json({ error: 'twofa_qr_failed' });
  }
  return res.json({ ok: true, require2FASetup: true, preAuthToken, qrDataUrl, manualKey: secret.base32, user: { email, role: 'MAIL_USER' } });
};

app.post('/api/auth/login', handleAuthLogin);
app.post('/api/auth/mail-login', handleAuthLogin);

app.post('/api/auth/verify-2fa', async (req, res) => {
  const preAuthToken = typeof req.body?.preAuthToken === 'string' ? req.body.preAuthToken : '';
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  const backupCode = typeof req.body?.backupCode === 'string' ? req.body.backupCode.trim() : '';
  if (!preAuthToken) return res.status(400).json({ error: 'missing_preauth' });
  if (!token && !backupCode) return res.status(400).json({ error: 'missing_2fa_code' });

  try {
    const block = await getLoginBlock();
    if (block.blocked) return res.status(403).json({ error: 'login_blocked', message: block.message || undefined });
  } catch {
  }

  let payload = null;
  try {
    payload = jwt.verify(preAuthToken, PREAUTH_JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'preauth_expired' });
  }
  if (!payload || typeof payload !== 'object') return res.status(401).json({ error: 'preauth_expired' });
  const decoded = payload;
  const role = typeof decoded.role === 'string' ? decoded.role : '';
  if (role !== 'PREAUTH') return res.status(401).json({ error: 'preauth_expired' });
  const email = typeof decoded.email === 'string' ? decoded.email : '';
  const emailKey = normalizeEmailKey(email);
  const sessionId = typeof decoded.sub === 'string' ? decoded.sub : '';
  const encPassword =
    decoded.ep &&
    typeof decoded.ep === 'object' &&
    typeof decoded.ep.iv === 'string' &&
    typeof decoded.ep.tag === 'string' &&
    typeof decoded.ep.ciphertext === 'string'
      ? decoded.ep
      : null;
  const csrfToken = typeof decoded.csrf === 'string' ? decoded.csrf : null;
  const ttlMs = typeof decoded.ttl === 'number' && Number.isFinite(decoded.ttl) ? decoded.ttl : SESSION_TTL_MS;
  const sessionVersion = typeof decoded.sv === 'number' && Number.isFinite(decoded.sv) ? decoded.sv : 0;
  if (!emailKey || !sessionId || !encPassword || !csrfToken) return res.status(401).json({ error: 'preauth_expired' });

  try {
    const emailCheck = await checkEmailAllowed(emailKey);
    if (!emailCheck.ok) return res.status(403).json({ error: 'email_blocked', message: 'Sign-in for this email is blocked.' });
  } catch {
  }

  try {
    const domainCheck = await checkDomainAllowed(emailKey);
    if (!domainCheck.ok) {
      const msg =
        domainCheck.error === 'domain_blocked'
          ? `Sign-ins from @${domainCheck.domain} are blocked.`
          : domainCheck.error === 'domain_not_allowed'
            ? `Sign-ins from @${domainCheck.domain} are not allowed.`
            : 'Sign-in domain is not allowed.';
      return res.status(403).json({ error: 'domain_blocked', message: msg });
    }
  } catch {
  }

  const user = await storeGetUser(emailKey);
  if (!user || !user.twofa_enabled || typeof user.twofa_secret_enc !== 'string') return res.status(403).json({ error: 'twofa_not_enabled' });
  const lockUntil = user.lockout_until ? new Date(user.lockout_until).getTime() : null;
  if (lockUntil && lockUntil > Date.now()) return res.status(429).json({ error: 'twofa_locked', retryAt: lockUntil });

  let ok = false;
  let usedBackup = false;
  if (backupCode) {
    const consumed = await storeConsumeBackupCode(emailKey, backupCode);
    usedBackup = consumed.used;
    ok = consumed.used;
  } else {
    let secret = '';
    try {
      secret = decryptFromString(user.twofa_secret_enc);
    } catch {
      return res.status(500).json({ error: 'twofa_secret_unavailable' });
    }
    ok = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      step: TWOFA_STEP_SECONDS,
      window: TWOFA_WINDOW,
    });
  }

  if (!ok) {
    const r = await storeRecord2faFailure(emailKey);
    if (r.locked) return res.status(429).json({ error: 'twofa_locked', retryAt: r.until });
    return res.status(401).json({ error: 'invalid_2fa_code' });
  }

  await storeRecord2faSuccess(emailKey);
  const svOk = await storeCheckSessionVersion(emailKey, sessionVersion);
  if (!svOk) return res.status(401).json({ error: 'session_revoked' });

  const result = await finishLogin({
    email,
    encPassword,
    csrfToken,
    sessionId,
    ttlMs,
    sessionVersion,
    twoFactorVerified: true,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  return res.json({ ...result, usedBackup });
});

app.post('/api/auth/confirm-2fa-preauth', async (req, res) => {
  const preAuthToken = typeof req.body?.preAuthToken === 'string' ? req.body.preAuthToken : '';
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  const logoutAllSessions = req.body?.logoutAllSessions !== undefined ? Boolean(req.body.logoutAllSessions) : true;
  if (!preAuthToken) return res.status(400).json({ error: 'missing_preauth' });
  if (!token) return res.status(400).json({ error: 'missing_2fa_code' });

  try {
    const block = await getLoginBlock();
    if (block.blocked) return res.status(403).json({ error: 'login_blocked', message: block.message || undefined });
  } catch {
  }

  let payload = null;
  try {
    payload = jwt.verify(preAuthToken, PREAUTH_JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'preauth_expired' });
  }
  if (!payload || typeof payload !== 'object') return res.status(401).json({ error: 'preauth_expired' });
  const decoded = payload;
  const role = typeof decoded.role === 'string' ? decoded.role : '';
  if (role !== 'PREAUTH_SETUP') return res.status(401).json({ error: 'preauth_expired' });
  const email = typeof decoded.email === 'string' ? decoded.email : '';
  const emailKey = normalizeEmailKey(email);
  const sessionId = typeof decoded.sub === 'string' ? decoded.sub : '';
  const encPassword =
    decoded.ep &&
    typeof decoded.ep === 'object' &&
    typeof decoded.ep.iv === 'string' &&
    typeof decoded.ep.tag === 'string' &&
    typeof decoded.ep.ciphertext === 'string'
      ? decoded.ep
      : null;
  const csrfToken = typeof decoded.csrf === 'string' ? decoded.csrf : null;
  const ttlMs = typeof decoded.ttl === 'number' && Number.isFinite(decoded.ttl) ? decoded.ttl : SESSION_TTL_MS;
  const sessionVersion = typeof decoded.sv === 'number' && Number.isFinite(decoded.sv) ? decoded.sv : 0;
  if (!emailKey || !sessionId || !encPassword || !csrfToken) return res.status(401).json({ error: 'preauth_expired' });

  try {
    const emailCheck = await checkEmailAllowed(emailKey);
    if (!emailCheck.ok) return res.status(403).json({ error: 'email_blocked', message: 'Sign-in for this email is blocked.' });
  } catch {
  }

  try {
    const domainCheck = await checkDomainAllowed(emailKey);
    if (!domainCheck.ok) {
      const msg =
        domainCheck.error === 'domain_blocked'
          ? `Sign-ins from @${domainCheck.domain} are blocked.`
          : domainCheck.error === 'domain_not_allowed'
            ? `Sign-ins from @${domainCheck.domain} are not allowed.`
            : 'Sign-in domain is not allowed.';
      return res.status(403).json({ error: 'domain_blocked', message: msg });
    }
  } catch {
  }

  const svOkBefore = await storeCheckSessionVersion(emailKey, sessionVersion);
  if (!svOkBefore) return res.status(401).json({ error: 'session_revoked' });

  const user = await storeGetUser(emailKey);
  if (!user || typeof user.temp_twofa_secret_enc !== 'string') return res.status(400).json({ error: 'twofa_setup_required' });
  if (user.twofa_enabled) return res.status(400).json({ error: 'twofa_already_enabled' });
  const lockUntil = user.lockout_until ? new Date(user.lockout_until).getTime() : null;
  if (lockUntil && lockUntil > Date.now()) return res.status(429).json({ error: 'twofa_locked', retryAt: lockUntil });

  let secret = '';
  try {
    secret = decryptFromString(user.temp_twofa_secret_enc);
  } catch {
    return res.status(500).json({ error: 'twofa_secret_unavailable' });
  }

  const ok = speakeasy.totp.verify({ secret, encoding: 'base32', token, step: TWOFA_STEP_SECONDS, window: TWOFA_WINDOW });
  if (!ok) {
    const r = await storeRecord2faFailure(emailKey);
    if (r.locked) return res.status(429).json({ error: 'twofa_locked', retryAt: r.until });
    return res.status(401).json({ error: 'invalid_2fa_code' });
  }

  await storeRecord2faSuccess(emailKey);
  const rawCodes = generateBackupCodes(10);
  const hashed = rawCodes.map((c) => hashBackupCode(c));
  const nextSv = await storeEnable2fa({ emailKey, secretEnc: user.temp_twofa_secret_enc, backupCodesHashed: hashed, logoutAllSessions });
  if (nextSv === null) return res.status(500).json({ error: 'twofa_enable_failed' });

  const result = await finishLogin({
    email,
    encPassword,
    csrfToken,
    sessionId,
    ttlMs,
    sessionVersion: nextSv,
    twoFactorVerified: true,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  return res.json({ ...result, backupCodes: rawCodes });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const name = req.session.email.split('@')[0] || req.session.email;
  return res.json({ name, email: req.session.email, role: 'MAIL_USER', status: 'Active' });
});

app.get('/api/auth/2fa/status', requireAuth, async (req, res) => {
  const emailKey = normalizeEmailKey(req.session.email);
  const user = await storeGetUser(emailKey);
  return res.json({ enabled: Boolean(user && user.twofa_enabled), configured: true, storage: db ? 'db' : 'file' });
});

app.post('/api/auth/enable-2fa', requireAuth, requireCsrf, async (req, res) => {
  const emailKey = normalizeEmailKey(req.session.email);
  const existing = await storeGetUser(emailKey);
  if (!existing) await storeUpsertLoginPassword(emailKey, req.session.encPassword);
  const secret = speakeasy.generateSecret({ length: 20, name: `ArcMail:${req.session.email}`, issuer: 'ArcMail' });
  const tempEnc = encryptToString(secret.base32);
  await storeSetTemp2faSecret(emailKey, tempEnc);
  const otpauthUrl = typeof secret.otpauth_url === 'string' ? secret.otpauth_url : '';
  if (!otpauthUrl) return res.status(500).json({ error: 'twofa_setup_failed' });
  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, scale: 6 });
  } catch {
    return res.status(500).json({ error: 'twofa_qr_failed' });
  }
  return res.json({ ok: true, qrDataUrl, manualKey: secret.base32 });
});

app.post('/api/auth/confirm-2fa', requireAuth, requireCsrf, async (req, res) => {
  const otp = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  const logoutAllSessions = Boolean(req.body?.logoutAllSessions);
  if (!otp) return res.status(400).json({ error: 'missing_2fa_code' });

  const emailKey = normalizeEmailKey(req.session.email);
  const user = await storeGetUser(emailKey);
  if (!user || typeof user.temp_twofa_secret_enc !== 'string') return res.status(400).json({ error: 'twofa_setup_required' });

  let secret = '';
  try {
    secret = decryptFromString(user.temp_twofa_secret_enc);
  } catch {
    return res.status(500).json({ error: 'twofa_secret_unavailable' });
  }

  const ok = speakeasy.totp.verify({ secret, encoding: 'base32', token: otp, step: TWOFA_STEP_SECONDS, window: TWOFA_WINDOW });
  if (!ok) return res.status(401).json({ error: 'invalid_2fa_code' });

  const rawCodes = generateBackupCodes(10);
  const hashed = rawCodes.map((c) => hashBackupCode(c));
  const nextSv = await storeEnable2fa({ emailKey, secretEnc: user.temp_twofa_secret_enc, backupCodesHashed: hashed, logoutAllSessions });
  if (nextSv === null) return res.status(500).json({ error: 'twofa_enable_failed' });

  const token = logoutAllSessions
    ? signToken({
        sessionId: req.session.id,
        email: req.session.email,
        ttlMs: req.session.ttlMs,
        encPassword: req.session.encPassword,
        csrfToken: req.session.csrfToken,
        sessionVersion: nextSv,
        twoFactorVerified: true,
      })
    : null;

  return res.json({ ok: true, backupCodes: rawCodes, token, sessionVersion: nextSv });
});

app.post('/api/auth/disable-2fa', requireAuth, requireCsrf, async (req, res) => {
  const otp = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  const backupCode = typeof req.body?.backupCode === 'string' ? req.body.backupCode.trim() : '';
  if (!otp && !backupCode) return res.status(400).json({ error: 'missing_2fa_code' });
  const emailKey = normalizeEmailKey(req.session.email);
  const user = await storeGetUser(emailKey);
  if (!user || !user.twofa_enabled || typeof user.twofa_secret_enc !== 'string') return res.status(400).json({ error: 'twofa_not_enabled' });

  const lockUntil = user.lockout_until ? new Date(user.lockout_until).getTime() : null;
  if (lockUntil && lockUntil > Date.now()) return res.status(429).json({ error: 'twofa_locked', retryAt: lockUntil });

  let ok = false;
  if (backupCode) {
    const consumed = await storeConsumeBackupCode(emailKey, backupCode);
    ok = consumed.used;
  } else {
    let secret = '';
    try {
      secret = decryptFromString(user.twofa_secret_enc);
    } catch {
      return res.status(500).json({ error: 'twofa_secret_unavailable' });
    }
    ok = speakeasy.totp.verify({ secret, encoding: 'base32', token: otp, step: TWOFA_STEP_SECONDS, window: TWOFA_WINDOW });
  }

  if (!ok) {
    const r = await storeRecord2faFailure(emailKey);
    if (r.locked) return res.status(429).json({ error: 'twofa_locked', retryAt: r.until });
    return res.status(401).json({ error: 'invalid_2fa_code' });
  }

  const nextSv = await storeDisable2fa(emailKey);
  if (nextSv === null) return res.status(500).json({ error: 'twofa_disable_failed' });

  const token = signToken({
    sessionId: req.session.id,
    email: req.session.email,
    ttlMs: req.session.ttlMs,
    encPassword: req.session.encPassword,
    csrfToken: req.session.csrfToken,
    sessionVersion: nextSv,
    twoFactorVerified: true,
  });
  return res.json({ ok: true, token, sessionVersion: nextSv });
});

const resetAll2fa = async () => {
  if (db) {
    const r = await db.query(
      `UPDATE arcmail_users
       SET twofa_enabled = FALSE,
           twofa_secret_enc = NULL,
           temp_twofa_secret_enc = NULL,
           backup_codes = '[]'::jsonb,
           failed_2fa_attempts = 0,
           lockout_until = NULL,
           last_2fa_verified_at = NULL,
           session_version = session_version + 1,
           updated_at = now()`
    );
    return { reset: r.rowCount || 0, storage: 'db' };
  }

  const store = authStore && typeof authStore === 'object' && !Array.isArray(authStore) ? authStore : {};
  const entries = Object.entries(store);
  const nextStore = {};
  for (const [emailKey, entry] of entries) {
    const prev = entry && typeof entry === 'object' && !Array.isArray(entry) ? entry : {};
    const currentSv = typeof prev.session_version === 'number' ? prev.session_version : 0;
    nextStore[emailKey] = {
      ...prev,
      twofa_enabled: false,
      twofa_secret_enc: null,
      temp_twofa_secret_enc: null,
      backup_codes: [],
      failed_2fa_attempts: 0,
      lockout_until: null,
      last_2fa_verified_at: null,
      session_version: currentSv + 1,
      updated_at: new Date().toISOString(),
    };
  }
  authStore = nextStore;
  writeAuthStore(nextStore);
  return { reset: entries.length, storage: 'file' };
};

app.post('/api/auth/dev/reset-2fa', express.json({ limit: '50kb' }), async (req, res) => {
  if (IS_PROD) return res.status(404).json({ error: 'not_found' });
  const tokenHeader = typeof req.headers['x-dev-admin-token'] === 'string' ? req.headers['x-dev-admin-token'] : '';
  const tokenBody = typeof req.body?.token === 'string' ? req.body.token : '';
  const token = String(tokenHeader || tokenBody || '').trim();
  const host = String(req.hostname || '').toLowerCase();
  const ip = String(req.ip || '').toLowerCase();
  const isLocal = host === 'localhost' || host === '127.0.0.1' || ip.includes('127.0.0.1') || ip.includes('::1');
  if (DEV_ADMIN_TOKEN) {
    if (!token || token !== DEV_ADMIN_TOKEN) return res.status(401).json({ error: 'unauthorized' });
  } else if (!isLocal) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const result = await resetAll2fa();
  return res.json({ ok: true, ...result });
});

app.post('/api/auth/admin/reset-2fa', express.json({ limit: '50kb' }), async (req, res) => {
  if (!ADMIN_RESET_2FA_TOKEN) return res.status(404).json({ error: 'not_found' });
  const tokenHeader = typeof req.headers['x-admin-token'] === 'string' ? req.headers['x-admin-token'] : '';
  const tokenBody = typeof req.body?.token === 'string' ? req.body.token : '';
  const token = String(tokenHeader || tokenBody || '').trim();
  if (!token || token !== ADMIN_RESET_2FA_TOKEN) return res.status(401).json({ error: 'unauthorized' });
  const result = await resetAll2fa();
  return res.json({ ok: true, ...result });
});

app.get('/api/account/profile', requireAuth, async (req, res) => {
  const emailKey = String(req.session.email || '').trim().toLowerCase();
  if (db) {
    try {
      const profile = await dbGetProfile(emailKey);
      if (profile) return res.json({ ok: true, profile, storage: 'db' });
    } catch {
    }
  }
  const stored = await getStoredProfile(emailKey);
  if (stored) {
    const displayName = typeof stored.displayName === 'string' ? stored.displayName : null;
    const avatarDataUrl = typeof stored.avatarUrl === 'string' ? stored.avatarUrl : null;
    return res.json({ ok: true, profile: { displayName, avatarDataUrl }, storage: 'object' });
  }
  const entry = getProfileEntry(emailKey);
  const displayName = entry && typeof entry.displayName === 'string' ? entry.displayName : null;
  const avatarDataUrl = entry && typeof entry.avatarDataUrl === 'string' ? entry.avatarDataUrl : null;
  return res.json({ ok: true, profile: { displayName, avatarDataUrl }, storage: 'local' });
});

app.put('/api/account/profile', requireAuth, express.json({ limit: '600kb' }), async (req, res) => {
  const emailKey = String(req.session.email || '').trim().toLowerCase();
  const displayNameRaw = typeof req.body?.displayName === 'string' ? req.body.displayName : '';
  const avatarRaw = typeof req.body?.avatarDataUrl === 'string' ? req.body.avatarDataUrl : null;

  const displayName = displayNameRaw.trim().replace(/[\r\n]+/g, ' ').slice(0, 72);
  const isUrl = typeof avatarRaw === 'string' && /^https?:\/\//i.test(avatarRaw) && avatarRaw.length <= 5000;
  const parsed = typeof avatarRaw === 'string' ? parseImageDataUrl(avatarRaw) : null;

  let avatarDataUrlToStore = isUrl ? avatarRaw : null;
  let storage = db ? 'db' : 'local';
  let persisted = false;

  if (parsed) {
    if (parsed.buf.length > 350_000) return res.status(400).json({ error: 'image_too_large' });
    if (s3 && S3_PUBLIC_BASE_URL) {
      const extension =
        parsed.contentType === 'image/png'
          ? 'png'
          : parsed.contentType === 'image/jpeg'
            ? 'jpg'
            : parsed.contentType === 'image/webp'
              ? 'webp'
              : parsed.contentType === 'image/gif'
                ? 'gif'
                : 'img';
      const key = avatarObjectKey(emailKey, extension);
      try {
        await s3.send(
          new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: key,
            Body: parsed.buf,
            ContentType: parsed.contentType,
            CacheControl: 'public, max-age=31536000, immutable',
          })
        );
      } catch {
        return res.status(502).json({ error: 'storage_upload_failed' });
      }
      avatarDataUrlToStore = `${S3_PUBLIC_BASE_URL}/${key}`;
      storage = 'object';
    } else {
      avatarDataUrlToStore = avatarRaw;
      storage = db ? 'db' : 'local';
    }
  } else if (avatarRaw !== null && avatarRaw !== undefined && avatarRaw !== '' && !isUrl) {
    return res.status(400).json({ error: 'invalid_avatar' });
  }

  const prev = getProfileEntry(emailKey) || {};
  const nextEntry = {
    ...prev,
    displayName: displayName || null,
    avatarDataUrl: avatarRaw === null ? null : avatarDataUrlToStore,
    updatedAt: new Date().toISOString(),
  };

  if (db) {
    try {
      persisted = await dbSetProfile(emailKey, { displayName: displayName || null, avatarDataUrl: avatarRaw === null ? null : avatarDataUrlToStore });
      storage = 'db';
    } catch {
      persisted = false;
      storage = 'db';
    }
  } else if (s3) {
    const ok =
      avatarRaw === null && !displayName
        ? await deleteStoredProfile(emailKey)
        : await putStoredProfile(emailKey, {
            displayName: displayName || null,
            avatarUrl: avatarRaw === null ? null : avatarDataUrlToStore,
            updatedAt: nextEntry.updatedAt,
          });
    persisted = ok;
    storage = 'object';
  } else {
    persisted = setProfileEntry(emailKey, nextEntry);
    storage = 'local';
  }

  setProfileEntry(emailKey, nextEntry);
  return res.json({ ok: true, persisted, storage, profile: nextEntry });
});

app.post('/api/notifications/subscribe', requireAuth, requireCsrf, async (req, res) => {
  if (!PUSH_ENABLED) return res.status(501).json({ error: 'push_unconfigured' });
  const emailKey = String(req.session.email || '').trim().toLowerCase();
  const subscription = req.body?.subscription;
  if (!subscription || typeof subscription !== 'object') return res.status(400).json({ error: 'invalid_payload' });
  const endpoint = 'endpoint' in subscription && typeof subscription.endpoint === 'string' ? subscription.endpoint : '';
  const keys = 'keys' in subscription && subscription.keys && typeof subscription.keys === 'object' ? subscription.keys : null;
  const p256dh = keys && 'p256dh' in keys && typeof keys.p256dh === 'string' ? keys.p256dh : '';
  const auth = keys && 'auth' in keys && typeof keys.auth === 'string' ? keys.auth : '';
  if (!endpoint || !p256dh || !auth) return res.status(400).json({ error: 'invalid_subscription' });

  const entry = pushStateByEmail.get(emailKey) || { email: '', encPassword: null, subs: new Map(), lastUnseen: null, lastCheckedAt: 0 };
  entry.email = String(req.session.email || '').trim();
  entry.encPassword = req.session.encPassword;
  entry.subs.set(endpoint, { endpoint, keys: { p256dh, auth } });
  pushStateByEmail.set(emailKey, entry);

  if (typeof entry.lastUnseen !== 'number') {
    try {
      const password = decryptString(req.session.encPassword);
      const unseen = await withImap({ email: req.session.email, password, folder: 'INBOX' }, async (client) => {
        try {
          const s = await client.status('INBOX', { unseen: true });
          return Number(s.unseen || 0);
        } catch {
          return 0;
        }
      });
      entry.lastUnseen = unseen;
      entry.lastCheckedAt = nowMs();
      pushStateByEmail.set(emailKey, entry);
    } catch {
    }
  }

  return res.json({ ok: true });
});

app.post('/api/notifications/unsubscribe', requireAuth, requireCsrf, (req, res) => {
  const emailKey = String(req.session.email || '').trim().toLowerCase();
  const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint : '';
  if (!endpoint) return res.status(400).json({ error: 'invalid_payload' });
  const entry = pushStateByEmail.get(emailKey);
  if (entry && entry.subs instanceof Map) {
    entry.subs.delete(endpoint);
    if (entry.subs.size === 0) pushStateByEmail.delete(emailKey);
  }
  return res.json({ ok: true });
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

    const emailKey = String(req.session.email || '').trim();
    if (ARCMAIL_AI_ENABLED && result && Array.isArray(result.threads) && result.threads.length > 0) {
      const uids = result.threads.map((t) => Number(t?.id)).filter((n) => Number.isFinite(n));
      const aiMap = await getEmailAIBatch({ db, emailKey, folder, uids });
      const threads = result.threads.map((t) => {
        const ai = aiMap.get(String(t.id)) || null;
        return {
          ...t,
          ai: ai
            ? {
                summary: ai.summary || null,
                label: ai.label || null,
                priority: Number.isFinite(ai.priority) ? ai.priority : null,
                extractedData: ai.extractedData || null,
              }
            : null,
        };
      });

      const needs = threads.filter((t) => !t.ai || !Number.isFinite(t.ai.priority)).slice(0, 12);
      for (const t of needs) {
        const uid = Number(t.id);
        if (!Number.isFinite(uid)) continue;
        scheduleProcessIncomingEmail({
          db,
          emailKey,
          folder,
          uid,
          messageId: null,
          getEmail: async () => {
            const thread = await withImap({ email: emailKey, password, folder }, async (client) => {
              let msg = null;
              try {
                msg = await client.fetchOne(uid, { envelope: true, source: true }, { uid: true });
              } catch {
                msg = null;
              }
              if (!msg || !msg.source) return null;
              const parsed = await simpleParser(msg.source);
              const from = msg.envelope?.from?.[0] || null;
              const to = msg.envelope?.to || [];
              const date = (msg.envelope?.date || parsed?.date || new Date()).toISOString();
              return {
                subject: msg.envelope?.subject || parsed?.subject || '(no subject)',
                fromName: from?.name || '',
                fromAddress: String(from?.address || ''),
                to: to.map((a) => ({ name: a.name || undefined, address: String(a.address || '') })),
                date,
                text: parsed?.text || '',
                html: typeof parsed?.html === 'string' ? parsed.html : '',
              };
            });
            return thread;
          },
          force: false,
        }).catch(() => null);
      }

      return res.json({ ...result, threads });
    }

    return res.json({ ...result, threads: result?.threads?.map((t) => ({ ...t, ai: null })) || [] });
  } catch (err) {
    if (isImapAuthFailure(err)) return res.status(401).json({ error: 'invalid_credentials' });
    const code = getErrorCode(err);
    return res.status(502).json({ error: 'imap_error', code, details: imapErrorDetails(err) });
  }
});

app.get('/api/emails/priority', requireAuth, async (req, res) => {
  const folder = typeof req.query?.folder === 'string' ? req.query.folder : 'INBOX';
  const bucket = typeof req.query?.bucket === 'string' ? String(req.query.bucket).toLowerCase() : 'all';
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

      const nextCursor = startSeq > 1 ? String(startSeq - 1) : undefined;
      return { threads, nextCursor };
    });

    const emailKey = String(req.session.email || '').trim();
    const uids = (result.threads || []).map((t) => Number(t?.id)).filter((n) => Number.isFinite(n));
    const aiMap = ARCMAIL_AI_ENABLED ? await getEmailAIBatch({ db, emailKey, folder, uids }) : new Map();

    const withAi = (result.threads || []).map((t) => {
      const ai = aiMap.get(String(t.id)) || null;
      const priority = ai && Number.isFinite(ai.priority) ? Number(ai.priority) : 0;
      const out = {
        ...t,
        ai: ai
          ? {
              summary: ai.summary || null,
              label: ai.label || null,
              priority: Number.isFinite(ai.priority) ? ai.priority : null,
              extractedData: ai.extractedData || null,
            }
          : null,
        _priority: priority,
      };
      return out;
    });

    const filtered = withAi.filter((t) => {
      const p = Number(t._priority || 0);
      if (bucket === 'high') return p > 70;
      if (bucket === 'medium') return p >= 40 && p <= 70;
      if (bucket === 'low') return p < 40;
      return true;
    });

    filtered.sort((a, b) => {
      const ap = Number(a._priority || 0);
      const bp = Number(b._priority || 0);
      if (bp !== ap) return bp - ap;
      return a.lastMessageAt > b.lastMessageAt ? -1 : a.lastMessageAt < b.lastMessageAt ? 1 : 0;
    });

    const threads = filtered.map(({ _priority, ...rest }) => rest);
    return res.json({ threads, nextCursor: result.nextCursor });
  } catch (err) {
    if (isImapAuthFailure(err)) return res.status(401).json({ error: 'invalid_credentials' });
    const code = getErrorCode(err);
    return res.status(502).json({ error: 'imap_error', code, details: imapErrorDetails(err) });
  }
});

const requireAiEnabled = (_req, res) => {
  if (!ARCMAIL_AI_ENABLED) {
    res.status(503).json({ error: 'ai_disabled' });
    return false;
  }
  return true;
};

const fetchEmailForAI = async ({ email, password, folder, uid }) => {
  const msg = await withImap({ email, password, folder }, async (client) => {
    let m = null;
    try {
      m = await client.fetchOne(uid, { envelope: true, source: true }, { uid: true });
    } catch {
      m = null;
    }
    if (!m || !m.source) return null;
    const parsed = await simpleParser(m.source);
    const from = m.envelope?.from?.[0] || null;
    const to = m.envelope?.to || [];
    const date = (m.envelope?.date || parsed?.date || new Date()).toISOString();
    return {
      subject: m.envelope?.subject || parsed?.subject || '(no subject)',
      fromName: from?.name || '',
      fromAddress: String(from?.address || ''),
      to: to.map((a) => ({ name: a.name || undefined, address: String(a.address || '') })),
      date,
      text: typeof parsed?.text === 'string' ? parsed.text : '',
      html: typeof parsed?.html === 'string' ? parsed.html : '',
    };
  });
  return msg;
};

app.post('/api/ai/summarize', requireAuth, async (req, res) => {
  if (!requireAiEnabled(req, res)) return;
  const folder = typeof req.body?.folder === 'string' ? req.body.folder : 'INBOX';
  const uid = Number(req.body?.id);
  const force = Boolean(req.body?.force);
  if (!Number.isFinite(uid)) return res.status(400).json({ error: 'invalid_id' });

  let password = '';
  try {
    password = decryptString(req.session.encPassword);
  } catch {
    return res.status(401).json({ error: 'session_expired' });
  }

  try {
    const emailKey = String(req.session.email || '').trim();
    const email = await fetchEmailForAI({ email: emailKey, password, folder, uid });
    if (!email) return res.status(404).json({ error: 'not_found' });
    const result = await processIncomingEmail({ db, emailKey, folder, uid, messageId: null, email, force });
    return res.json({ summary: result.ai.summary });
  } catch {
    return res.status(502).json({ error: 'ai_error' });
  }
});

app.post('/api/ai/classify', requireAuth, async (req, res) => {
  if (!requireAiEnabled(req, res)) return;
  const folder = typeof req.body?.folder === 'string' ? req.body.folder : 'INBOX';
  const uid = Number(req.body?.id);
  const force = Boolean(req.body?.force);
  if (!Number.isFinite(uid)) return res.status(400).json({ error: 'invalid_id' });

  let password = '';
  try {
    password = decryptString(req.session.encPassword);
  } catch {
    return res.status(401).json({ error: 'session_expired' });
  }

  try {
    const emailKey = String(req.session.email || '').trim();
    const email = await fetchEmailForAI({ email: emailKey, password, folder, uid });
    if (!email) return res.status(404).json({ error: 'not_found' });
    const result = await processIncomingEmail({ db, emailKey, folder, uid, messageId: null, email, force });
    return res.json({ label: result.ai.label });
  } catch {
    return res.status(502).json({ error: 'ai_error' });
  }
});

app.post('/api/ai/extract', requireAuth, async (req, res) => {
  if (!requireAiEnabled(req, res)) return;
  const folder = typeof req.body?.folder === 'string' ? req.body.folder : 'INBOX';
  const uid = Number(req.body?.id);
  const force = Boolean(req.body?.force);
  if (!Number.isFinite(uid)) return res.status(400).json({ error: 'invalid_id' });

  let password = '';
  try {
    password = decryptString(req.session.encPassword);
  } catch {
    return res.status(401).json({ error: 'session_expired' });
  }

  try {
    const emailKey = String(req.session.email || '').trim();
    const email = await fetchEmailForAI({ email: emailKey, password, folder, uid });
    if (!email) return res.status(404).json({ error: 'not_found' });
    const result = await processIncomingEmail({ db, emailKey, folder, uid, messageId: null, email, force });
    return res.json({ extractedData: result.ai.extractedData });
  } catch {
    return res.status(502).json({ error: 'ai_error' });
  }
});

app.post('/api/ai/reply', requireAuth, async (req, res) => {
  if (!requireAiEnabled(req, res)) return;
  const folder = typeof req.body?.folder === 'string' ? req.body.folder : 'INBOX';
  const uid = Number(req.body?.id);
  if (!Number.isFinite(uid)) return res.status(400).json({ error: 'invalid_id' });

  let password = '';
  try {
    password = decryptString(req.session.encPassword);
  } catch {
    return res.status(401).json({ error: 'session_expired' });
  }

  try {
    const emailKey = String(req.session.email || '').trim();
    const email = await fetchEmailForAI({ email: emailKey, password, folder, uid });
    if (!email) return res.status(404).json({ error: 'not_found' });
    const reply = await generateReply(email);
    return res.json({ reply });
  } catch {
    return res.status(502).json({ error: 'ai_error' });
  }
});

app.post('/api/ai/ask', requireAuth, async (req, res) => {
  if (!requireAiEnabled(req, res)) return;
  const folder = typeof req.body?.folder === 'string' ? req.body.folder : 'INBOX';
  const uid = Number(req.body?.id);
  const questionRaw = typeof req.body?.question === 'string' ? req.body.question : '';
  const question = questionRaw.trim();
  if (!Number.isFinite(uid)) return res.status(400).json({ error: 'invalid_id' });
  if (!question || question.length > 1200) return res.status(400).json({ error: 'invalid_question' });

  try {
    const bodyEmail = req.body?.email;
    const emailFromBody =
      bodyEmail && typeof bodyEmail === 'object'
        ? {
            subject: typeof bodyEmail.subject === 'string' ? bodyEmail.subject : '',
            fromName: typeof bodyEmail.fromName === 'string' ? bodyEmail.fromName : '',
            fromAddress: typeof bodyEmail.fromAddress === 'string' ? bodyEmail.fromAddress : '',
            to: Array.isArray(bodyEmail.to)
              ? bodyEmail.to
                  .map((a) =>
                    a && typeof a === 'object'
                      ? { name: typeof a.name === 'string' ? a.name : undefined, address: typeof a.address === 'string' ? a.address : '' }
                      : null,
                  )
                  .filter((a) => a && typeof a.address === 'string' && a.address)
              : [],
            date: typeof bodyEmail.date === 'string' ? bodyEmail.date : '',
            text: typeof bodyEmail.text === 'string' ? bodyEmail.text : '',
            html: typeof bodyEmail.html === 'string' ? bodyEmail.html : '',
          }
        : null;

    const emailKey = String(req.session.email || '').trim();
    const email = (() => {
      if (emailFromBody) return emailFromBody;
      return null;
    })();

    let finalEmail = email;
    if (!finalEmail) {
      let password = '';
      try {
        password = decryptString(req.session.encPassword);
      } catch {
        return res.status(401).json({ error: 'session_expired' });
      }
      finalEmail = await fetchEmailForAI({ email: emailKey, password, folder, uid });
      if (!finalEmail) return res.status(404).json({ error: 'not_found' });
    }

    const emailText = [
      `Subject: ${finalEmail.subject || '(no subject)'}`,
      `From: ${[finalEmail.fromName, finalEmail.fromAddress].filter(Boolean).join(' ') || '(unknown)'}`,
      `To: ${Array.isArray(finalEmail.to) ? finalEmail.to.map((a) => [a?.name, a?.address].filter(Boolean).join(' ').trim()).filter(Boolean).join(', ') : ''}`,
      finalEmail.date ? `Date: ${finalEmail.date}` : '',
      '',
      finalEmail.text && finalEmail.text.trim()
        ? finalEmail.text
        : finalEmail.html && finalEmail.html.trim()
          ? finalEmail.html.replace(/<[^>]+>/g, ' ')
          : '',
    ]
      .filter(Boolean)
      .join('\n')
      .slice(0, 2500);

    const prompt = [
      'Answer the user question about the email.',
      'Rules:',
      '- Use only information from the email. If the email does not contain the answer, say you do not know.',
      '- Be concise and specific.',
      '',
      `User question: ${question}`,
      '',
      'Email:',
      emailText,
    ].join('\n');

    let answer = '';
    try {
      answer = await runAI(prompt, { maxTokens: 520, temperature: 0.2 });
    } catch (err) {
      const code = err && typeof err === 'object' && typeof err.code === 'string' ? String(err.code) : null;
      if (code === 'GROQ_PAYLOAD_TOO_LARGE' || code === 'GROQ_BAD_REQUEST' || code === 'GROQ_REQUEST_ERROR') {
        const tighterEmailText = emailText.slice(0, 1200);
        const tighterPrompt = [
          'Answer the user question about the email.',
          'Rules:',
          '- Use only information from the email. If the email does not contain the answer, say you do not know.',
          '- Be concise and specific.',
          '',
          `User question: ${question.slice(0, 500)}`,
          '',
          'Email:',
          tighterEmailText,
        ].join('\n');
        answer = await runAI(tighterPrompt, { maxTokens: 260, temperature: 0.2, model: 'llama-3.1-8b-instant' });
      } else {
        throw err;
      }
    }
    return res.json({ answer });
  } catch (err) {
    const code = err && typeof err === 'object' && typeof err.code === 'string' ? String(err.code) : null;
    if (code === 'MISSING_GROQ_API_KEY') return res.status(503).json({ error: 'ai_disabled' });
    if (code === 'GROQ_AUTH_ERROR') return res.status(502).json({ error: 'ai_invalid_key' });
    if (code === 'GROQ_RATE_LIMIT') return res.status(502).json({ error: 'ai_rate_limited' });
    if (code === 'GROQ_PROVIDER_ERROR') return res.status(502).json({ error: 'ai_provider_error' });
    if (code === 'GROQ_PAYLOAD_TOO_LARGE') return res.status(502).json({ error: 'ai_request_too_large' });
    if (code === 'GROQ_BAD_REQUEST') return res.status(502).json({ error: 'ai_request_rejected' });
    if (code === 'GROQ_REQUEST_ERROR') return res.status(502).json({ error: 'ai_request_rejected' });
    return res.status(502).json({ error: 'ai_error' });
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

    if (!thread) return res.json({ thread: null });
    if (!ARCMAIL_AI_ENABLED) return res.json({ thread: { ...thread, ai: null } });

    const emailKey = String(req.session.email || '').trim();
    const cached = await getEmailAI({ db, emailKey, folder, uid });
    const ai = cached
      ? {
          summary: cached.summary || null,
          label: cached.label || null,
          priority: Number.isFinite(cached.priority) ? cached.priority : null,
          extractedData: cached.extractedData || null,
        }
      : null;

    if (!ai || !Number.isFinite(ai.priority)) {
      const m = Array.isArray(thread.messages) ? thread.messages[0] : null;
      if (m && (typeof m.text === 'string' || typeof m.html === 'string')) {
        scheduleProcessIncomingEmail({
          db,
          emailKey,
          folder,
          uid,
          messageId: null,
          getEmail: async () => ({
            subject: String(m.subject || thread.subject || '(no subject)'),
            fromName: String(m.fromName || ''),
            fromAddress: String(m.fromAddress || ''),
            to: Array.isArray(m.to) ? m.to : [],
            date: String(m.date || ''),
            text: typeof m.text === 'string' ? m.text : '',
            html: typeof m.html === 'string' ? m.html : '',
          }),
          force: false,
        }).catch(() => null);
      }
    }

    return res.json({ thread: { ...thread, ai } });
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
  try {
    void recordAuditEvent({
      eventType: 'logout',
      email: req.session.email,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      meta: { sessionId: req.session.id },
    });
  } catch {
  }
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
  if (!IS_PROD) {
    try {
      console.error(err);
    } catch {
    }
    const message = err && typeof err === 'object' && 'message' in err && typeof err.message === 'string' ? err.message : 'server_error';
    return res.status(status).json({ error: 'server_error', message });
  }
  return res.status(status).json({ error: 'server_error' });
});

const start = async () => {
  try {
    await ensureAuthSchema();
  } catch {
  }
  const server = app.listen(PORT, () => {
    const origin = allowedOrigins.length ? allowedOrigins[0] : 'unknown';
    const apiUrl = new URL(`http://localhost:${PORT}/api/health`);
    console.log(`API listening on ${apiUrl.toString()} (CORS: ${origin})`);
  });
  server.ref?.();
};

void start();

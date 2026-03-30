import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyEmail, contentHashForEmail, extractInfo, scoreEmailPriority, summarizeEmail } from './ai.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FILE_STORE_PATH = path.join(__dirname, '..', '..', 'server', 'arcmail-email-ai.json');
const MAX_FILE_BYTES = 12 * 1024 * 1024;

const keyFor = ({ emailKey, folder, uid }) => `${String(emailKey || '').toLowerCase()}|${String(folder || '')}|${String(uid || '')}`;

const readFileStore = () => {
  try {
    if (!fs.existsSync(FILE_STORE_PATH)) return {};
    const st = fs.statSync(FILE_STORE_PATH);
    if (!st.isFile()) return {};
    if (st.size > MAX_FILE_BYTES) return {};
    const raw = fs.readFileSync(FILE_STORE_PATH, 'utf8');
    if (!raw || !raw.trim()) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
};

const writeFileStore = (obj) => {
  try {
    fs.writeFileSync(FILE_STORE_PATH, JSON.stringify(obj), 'utf8');
  } catch {
    return;
  }
};

const dbGetAi = async (db, { emailKey, folder, uid }) => {
  if (!db) return null;
  const q = `SELECT summary,label,priority,extracted_data AS "extractedData",content_hash AS "contentHash" FROM arcmail_email_ai WHERE email=$1 AND folder=$2 AND uid=$3`;
  try {
    const r = await db.query(q, [String(emailKey || '').toLowerCase(), String(folder || ''), Number(uid)]);
    const row = r?.rows?.[0] || null;
    if (!row) return null;
    return {
      summary: typeof row.summary === 'string' ? row.summary : null,
      label: typeof row.label === 'string' ? row.label : null,
      priority: Number.isFinite(row.priority) ? Number(row.priority) : null,
      extractedData: row.extractedData && typeof row.extractedData === 'object' ? row.extractedData : null,
      contentHash: typeof row.contentHash === 'string' ? row.contentHash : null,
    };
  } catch {
    return null;
  }
};

const dbUpsertAi = async (db, { emailKey, folder, uid, messageId, contentHash, ai }) => {
  if (!db) return false;
  const q = `INSERT INTO arcmail_email_ai (email,folder,uid,message_id,content_hash,summary,label,priority,extracted_data,updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
    ON CONFLICT (email,folder,uid)
    DO UPDATE SET message_id=EXCLUDED.message_id, content_hash=EXCLUDED.content_hash, summary=EXCLUDED.summary, label=EXCLUDED.label, priority=EXCLUDED.priority, extracted_data=EXCLUDED.extracted_data, updated_at=now()`;
  try {
    await db.query(q, [
      String(emailKey || '').toLowerCase(),
      String(folder || ''),
      Number(uid),
      messageId ? String(messageId) : null,
      String(contentHash || ''),
      ai?.summary ? String(ai.summary) : null,
      ai?.label ? String(ai.label) : null,
      Number.isFinite(ai?.priority) ? Number(ai.priority) : null,
      ai?.extractedData ? ai.extractedData : null,
    ]);
    return true;
  } catch {
    return false;
  }
};

const fileGetAi = ({ emailKey, folder, uid }) => {
  const store = readFileStore();
  const k = keyFor({ emailKey, folder, uid });
  const v = store[k];
  if (!v || typeof v !== 'object') return null;
  return {
    summary: typeof v.summary === 'string' ? v.summary : null,
    label: typeof v.label === 'string' ? v.label : null,
    priority: Number.isFinite(v.priority) ? Number(v.priority) : null,
    extractedData: v.extractedData && typeof v.extractedData === 'object' ? v.extractedData : null,
    contentHash: typeof v.contentHash === 'string' ? v.contentHash : null,
  };
};

const fileUpsertAi = ({ emailKey, folder, uid, contentHash, ai }) => {
  const store = readFileStore();
  const k = keyFor({ emailKey, folder, uid });
  store[k] = {
    summary: ai?.summary ? String(ai.summary) : null,
    label: ai?.label ? String(ai.label) : null,
    priority: Number.isFinite(ai?.priority) ? Number(ai.priority) : null,
    extractedData: ai?.extractedData && typeof ai.extractedData === 'object' ? ai.extractedData : null,
    contentHash: String(contentHash || ''),
    updatedAt: new Date().toISOString(),
  };
  writeFileStore(store);
};

export const getEmailAI = async ({ db, emailKey, folder, uid }) => {
  const fromDb = await dbGetAi(db, { emailKey, folder, uid });
  if (fromDb) return fromDb;
  return fileGetAi({ emailKey, folder, uid });
};

export const getEmailAIBatch = async ({ db, emailKey, folder, uids }) => {
  const list = Array.isArray(uids) ? uids.map((u) => Number(u)).filter((n) => Number.isFinite(n)) : [];
  if (list.length === 0) return new Map();
  const keyLower = String(emailKey || '').toLowerCase();
  const map = new Map();
  if (db) {
    const q = `SELECT uid,summary,label,priority,extracted_data AS "extractedData",content_hash AS "contentHash" FROM arcmail_email_ai WHERE email=$1 AND folder=$2 AND uid = ANY($3::bigint[])`;
    try {
      const r = await db.query(q, [keyLower, String(folder || ''), list]);
      for (const row of r?.rows || []) {
        map.set(String(row.uid), {
          summary: typeof row.summary === 'string' ? row.summary : null,
          label: typeof row.label === 'string' ? row.label : null,
          priority: Number.isFinite(row.priority) ? Number(row.priority) : null,
          extractedData: row.extractedData && typeof row.extractedData === 'object' ? row.extractedData : null,
          contentHash: typeof row.contentHash === 'string' ? row.contentHash : null,
        });
      }
      return map;
    } catch {
      return map;
    }
  }
  const store = readFileStore();
  for (const uid of list) {
    const k = keyFor({ emailKey: keyLower, folder, uid });
    const v = store[k];
    if (!v || typeof v !== 'object') continue;
    map.set(String(uid), {
      summary: typeof v.summary === 'string' ? v.summary : null,
      label: typeof v.label === 'string' ? v.label : null,
      priority: Number.isFinite(v.priority) ? Number(v.priority) : null,
      extractedData: v.extractedData && typeof v.extractedData === 'object' ? v.extractedData : null,
      contentHash: typeof v.contentHash === 'string' ? v.contentHash : null,
    });
  }
  return map;
};

const computeEmailAI = async (email) => {
  const label = await classifyEmail(email);
  const extracted = await extractInfo(email);
  const priority = await scoreEmailPriority(email);
  const summary = await summarizeEmail(email);
  return {
    summary,
    label,
    priority,
    extractedData: {
      deadlines: Array.isArray(extracted?.deadlines) ? extracted.deadlines : [],
      tasks: Array.isArray(extracted?.tasks) ? extracted.tasks : [],
      important: Array.isArray(extracted?.important) ? extracted.important : [],
    },
  };
};

const queue = [];
let active = 0;
const inflight = new Map();
const CONCURRENCY = 2;

const drain = () => {
  while (active < CONCURRENCY && queue.length) {
    const job = queue.shift();
    if (!job) break;
    active += 1;
    Promise.resolve()
      .then(job.run)
      .then(job.resolve, job.reject)
      .finally(() => {
        active -= 1;
        if (job.key) inflight.delete(job.key);
        setImmediate(drain);
      });
  }
};

const enqueue = (key, run) => {
  if (key && inflight.has(key)) return inflight.get(key);
  const p = new Promise((resolve, reject) => {
    queue.push({ key, run, resolve, reject });
    setImmediate(drain);
  });
  if (key) inflight.set(key, p);
  return p;
};

export const processIncomingEmail = async ({ db, emailKey, folder, uid, messageId, email, force }) => {
  const contentHash = contentHashForEmail(email);
  if (!force) {
    const cached = await getEmailAI({ db, emailKey, folder, uid });
    if (cached && cached.contentHash && cached.contentHash === contentHash) {
      return { ai: { summary: cached.summary, label: cached.label, priority: cached.priority, extractedData: cached.extractedData }, cached: true };
    }
  }

  const ai = await computeEmailAI(email);
  const stored = await dbUpsertAi(db, { emailKey, folder, uid, messageId, contentHash, ai });
  if (!stored) fileUpsertAi({ emailKey, folder, uid, contentHash, ai });
  return { ai, cached: false };
};

export const scheduleProcessIncomingEmail = ({ db, emailKey, folder, uid, messageId, getEmail, force }) => {
  const key = keyFor({ emailKey, folder, uid });
  return enqueue(key, async () => {
    const email = await getEmail();
    if (!email) return null;
    const result = await processIncomingEmail({ db, emailKey, folder, uid, messageId, email, force: Boolean(force) });
    return result.ai || null;
  });
};

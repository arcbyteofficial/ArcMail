import crypto from 'node:crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';

const MODEL = 'gemini-flash-latest';
const SYSTEM_PROMPT =
  'You are an elite email intelligence engine. You analyze emails for importance, urgency, and actionable content. Be precise and structured. Do not hallucinate.';

const getClient = () => {
  const apiKey = String(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  if (!apiKey) {
    const err = new Error('Missing GEMINI_API_KEY');
    err.code = 'MISSING_GEMINI_API_KEY';
    throw err;
  }
  return new GoogleGenerativeAI(apiKey);
};

const clampText = (s, maxChars) => {
  const v = String(s || '');
  if (v.length <= maxChars) return v;
  return v.slice(0, maxChars);
};

const normalizeEmail = (email) => {
  const subject = email && typeof email.subject === 'string' ? email.subject : '';
  const fromName = email && typeof email.fromName === 'string' ? email.fromName : '';
  const fromAddress = email && typeof email.fromAddress === 'string' ? email.fromAddress : '';
  const to = Array.isArray(email?.to) ? email.to : [];
  const date = email && typeof email.date === 'string' ? email.date : '';
  const text = email && typeof email.text === 'string' ? email.text : '';
  const html = email && typeof email.html === 'string' ? email.html : '';
  const body = text.trim() ? text : html.trim() ? html.replace(/<[^>]+>/g, ' ') : '';

  return clampText(
    [
      `Subject: ${subject || '(no subject)'}`,
      `From: ${[fromName, fromAddress].filter(Boolean).join(' ') || '(unknown)'}`,
      `To: ${to
        .map((x) =>
          x && typeof x === 'object'
            ? [x.name, x.address].filter(Boolean).join(' ').trim()
            : String(x || '').trim(),
        )
        .filter(Boolean)
        .join(', ')}`,
      date ? `Date: ${date}` : '',
      '',
      body,
    ]
      .filter(Boolean)
      .join('\n'),
    12000,
  );
};

const parseFirstJsonObject = (s) => {
  const raw = String(s || '').trim();
  const withoutFences = raw.replace(/```[\s\S]*?```/g, (m) => m.replace(/```[a-zA-Z]*\n?/, '').replace(/```$/, ''));
  const start = withoutFences.indexOf('{');
  const end = withoutFences.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  const candidate = withoutFences.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
};

const stripMarkdownFences = (s) => {
  const raw = String(s || '').trim();
  const m = raw.match(/```[a-zA-Z]*\s*([\s\S]*?)\s*```/);
  if (m && typeof m[1] === 'string') return m[1].trim();
  return raw;
};

const parseJsonFromText = (s) => {
  const raw = stripMarkdownFences(s);
  const obj = parseFirstJsonObject(raw);
  if (obj) return obj;
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
};

const toStableJson = (value) => {
  const seen = new WeakSet();
  const walk = (v) => {
    if (v === null || typeof v !== 'object') return v;
    if (seen.has(v)) return null;
    seen.add(v);
    if (Array.isArray(v)) return v.map(walk);
    const keys = Object.keys(v).sort();
    const out = {};
    for (const k of keys) out[k] = walk(v[k]);
    return out;
  };
  return JSON.stringify(walk(value));
};

export const contentHashForEmail = (email) => {
  const normalized = normalizeEmail(email);
  return crypto.createHash('sha256').update(normalized).digest('hex');
};

export const runAI = async (prompt, options = {}) => {
  const genAI = getClient();
  const temperature = Number.isFinite(options.temperature) ? options.temperature : 0.2;
  const maxOutputTokens = Number.isFinite(options.maxTokens) ? options.maxTokens : 900;

  const model = genAI.getGenerativeModel({ model: MODEL });

  const fullPrompt = `${SYSTEM_PROMPT}\n\n${String(prompt || '')}`.trim();
  const request = { contents: [{ role: 'user', parts: [{ text: fullPrompt }] }], generationConfig: { temperature, maxOutputTokens } };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await model.generateContent(request);
      const t = res?.response?.text?.();
      const primary = typeof t === 'string' ? t : '';
      if (primary && primary.trim()) return primary.trim();
      const parts = res?.response?.candidates?.[0]?.content?.parts;
      const joined = Array.isArray(parts) ? parts.map((p) => (p && typeof p === 'object' && typeof p.text === 'string' ? p.text : '')).join('') : '';
      return String(joined || '').trim();
    } catch (err) {
      const message = err && typeof err === 'object' && typeof err.message === 'string' ? String(err.message) : 'AI request failed';
      const status = err && typeof err === 'object' && typeof err.status === 'number' ? err.status : null;
      const lower = message.toLowerCase();

      if (status === 429 && attempt < 2) {
        const jitter = Math.floor(Math.random() * 250);
        await sleep(700 * (attempt + 1) + jitter);
        continue;
      }

      const e = new Error(message);
      if (status === 401 || status === 403 || lower.includes('api key') || lower.includes('permission denied') || lower.includes('unauth')) e.code = 'AI_AUTH_ERROR';
      else if (status === 429 || lower.includes('quota') || lower.includes('rate')) e.code = 'AI_RATE_LIMIT';
      else if (status === 413 || lower.includes('payload') || lower.includes('too large')) e.code = 'AI_PAYLOAD_TOO_LARGE';
      else if (status === 404 && lower.includes('models/')) e.code = 'AI_MODEL_NOT_FOUND';
      else if (status === 400 || status === 404 || status === 422 || lower.includes('invalid') || lower.includes('bad request')) e.code = 'AI_BAD_REQUEST';
      else if (status && status >= 500) e.code = 'AI_PROVIDER_ERROR';
      else e.code = 'AI_REQUEST_ERROR';
      e.status = status || undefined;
      throw e;
    }
  }
};

export const summarizeEmail = async (email) => {
  const normalized = normalizeEmail(email);
  const prompt = [
    'Summarize the following email into exactly 3 bullet points.',
    'Rules:',
    '- Use "-" bullet prefix.',
    '- Be specific and actionable.',
    '- Do not invent facts.',
    '- Output only the 3 bullets, no extra text.',
    '',
    normalized,
  ].join('\n');
  const out = stripMarkdownFences(await runAI(prompt, { maxTokens: 240 }));
  const lines = String(out || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => l.startsWith('-'));
  const picked = lines.slice(0, 3);
  while (picked.length < 3) picked.push('-');
  return picked.join('\n');
};

export const generateReply = async (email) => {
  const normalized = normalizeEmail(email);
  const prompt = [
    'Write a professional email reply to the following email.',
    'Rules:',
    '- Keep it concise and polite.',
    '- Do not invent details; ask clarifying questions if needed.',
    '- Output only the reply body, no subject line.',
    '',
    normalized,
  ].join('\n');
  return stripMarkdownFences(await runAI(prompt, { maxTokens: 420, temperature: 0.35 }));
};

export const classifyEmail = async (email) => {
  const normalized = normalizeEmail(email);
  const prompt = [
    'Classify this email into exactly one label from this list:',
    '[Work, Personal, Finance, Spam, Updates]',
    'Rules:',
    '- Output only the label text.',
    '- Do not add punctuation.',
    '',
    normalized,
  ].join('\n');
  const out = stripMarkdownFences(await runAI(prompt, { maxTokens: 16, temperature: 0 }));
  const value = String(out || '').trim();
  const labels = new Set(['Work', 'Personal', 'Finance', 'Spam', 'Updates']);
  if (labels.has(value)) return value;
  const cleaned = value.replace(/[^A-Za-z]/g, '');
  if (labels.has(cleaned)) return cleaned;
  return 'Updates';
};

export const extractInfo = async (email) => {
  const normalized = normalizeEmail(email);
  const prompt = [
    'Extract structured information from the email. Output ONLY valid JSON with this exact shape:',
    '{"deadlines":[],"tasks":[],"important":[]}',
    'Rules:',
    '- Arrays must contain strings only.',
    '- Do not hallucinate. If unknown, keep arrays empty.',
    '- Output JSON only (no markdown, no code fences).',
    '',
    normalized,
  ].join('\n');
  const out = await runAI(prompt, { maxTokens: 350, temperature: 0 });
  const parsed = parseJsonFromText(out);
  const safe = (v) => (Array.isArray(v) ? v.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 20) : []);
  return {
    deadlines: safe(parsed?.deadlines),
    tasks: safe(parsed?.tasks),
    important: safe(parsed?.important),
    _raw: undefined,
    _stable: toStableJson({ deadlines: safe(parsed?.deadlines), tasks: safe(parsed?.tasks), important: safe(parsed?.important) }),
  };
};

export const scoreEmailPriority = async (email) => {
  const normalized = normalizeEmail(email);
  const prompt = [
    'Score the email priority from 0 to 100.',
    'Rules:',
    '- Output ONLY an integer number.',
    '- Consider urgency, sender intent, deadlines, and tone.',
    '- High score = urgent/important.',
    '',
    normalized,
  ].join('\n');
  const out = stripMarkdownFences(await runAI(prompt, { maxTokens: 16, temperature: 0 }));
  const m = String(out || '').match(/-?\d+/);
  const n = m ? Number(m[0]) : 0;
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
};

import OpenAI from 'openai';
import crypto from 'node:crypto';

const BASE_URL = 'https://api.groq.com/openai/v1';
const MODEL = 'llama-3.3-70b-versatile';
const MODEL_FALLBACKS = ['llama-3.1-70b-versatile', 'llama3-70b-8192', 'llama-3.1-8b-instant'];
const SYSTEM_PROMPT =
  'You are an elite email intelligence engine. You analyze emails for importance, urgency, and actionable content. Be precise and structured. Do not hallucinate.';

const getClient = () => { 
  const apiKey = String(process.env.GROQ_API_KEY || '').trim();
  if (!apiKey) {
    const err = new Error('Missing GROQ_API_KEY');
    err.code = 'MISSING_GROQ_API_KEY';
    throw err;
  }
  return new OpenAI({ apiKey, baseURL: BASE_URL });
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
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  const candidate = raw.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
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
  const client = getClient();
  const temperature = Number.isFinite(options.temperature) ? options.temperature : 0.2;
  const max_tokens = Number.isFinite(options.maxTokens) ? options.maxTokens : 900;
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: String(prompt || '') },
  ];
  const explicitModel = typeof options.model === 'string' ? options.model.trim() : '';
  const candidates = [explicitModel || MODEL, ...MODEL_FALLBACKS].filter(Boolean);

  let lastError = null;
  for (const candidate of candidates) {
    try {
      const res = await client.chat.completions.create({
        model: candidate,
        temperature,
        max_tokens,
        messages,
      });
      const text = res?.choices?.[0]?.message?.content;
      return String(text || '').trim();
    } catch (err) {
      const status = err && typeof err === 'object' && typeof err.status === 'number' ? err.status : null;
      const message = err && typeof err === 'object' && typeof err.message === 'string' ? String(err.message) : '';
      const e = new Error(message || 'AI request failed');
      if (status === 401 || status === 403) e.code = 'GROQ_AUTH_ERROR';
      else if (status === 429) e.code = 'GROQ_RATE_LIMIT';
      else if (status === 413) e.code = 'GROQ_PAYLOAD_TOO_LARGE';
      else if (status === 400 || status === 404 || status === 422) e.code = 'GROQ_BAD_REQUEST';
      else if (status && status >= 500) e.code = 'GROQ_PROVIDER_ERROR';
      else e.code = 'GROQ_REQUEST_ERROR';
      e.status = status || undefined;
      e.model = candidate;
      lastError = e;

      if (e.code === 'GROQ_AUTH_ERROR' || e.code === 'GROQ_RATE_LIMIT' || e.code === 'GROQ_PAYLOAD_TOO_LARGE') {
        throw e;
      }
      if (candidate === candidates[candidates.length - 1]) throw e;
    }
  }

  throw lastError || new Error('AI request failed');
};

export const summarizeEmail = async (email) => {
  const normalized = normalizeEmail(email);
  const prompt = [
    'Summarize the following email into exactly 3 bullet points.',
    'Rules:',
    '- Use "-" bullet prefix.',
    '- Be specific and actionable.',
    '- Do not invent facts.',
    '',
    normalized,
  ].join('\n');
  const out = await runAI(prompt, { maxTokens: 240 });
  const lines = out
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
  return await runAI(prompt, { maxTokens: 420, temperature: 0.35 });
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
  const out = (await runAI(prompt, { maxTokens: 12, temperature: 0 })).trim();
  const labels = new Set(['Work', 'Personal', 'Finance', 'Spam', 'Updates']);
  if (labels.has(out)) return out;
  const cleaned = out.replace(/[^A-Za-z]/g, '');
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
    '',
    normalized,
  ].join('\n');
  const out = await runAI(prompt, { maxTokens: 350, temperature: 0 });
  const parsed = parseFirstJsonObject(out);
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
  const out = await runAI(prompt, { maxTokens: 8, temperature: 0 });
  const m = String(out).match(/-?\d+/);
  const n = m ? Number(m[0]) : 0;
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
};

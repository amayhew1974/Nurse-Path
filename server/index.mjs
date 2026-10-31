// NursePath optional server.
//
// What it does:
//   1. Serves the built app from ../dist (run `npm run build` first).
//   2. Optionally provides live AI explanations at /api/ai/*. The AI key is read from the
//      ANTHROPIC_API_KEY environment variable on the server and is never sent to the browser.
//
// The app works fully without this server (open dist-single/index.html, or use any static host).
// Without a key, /api/ai/status reports "not available" and the app uses its sample library.
//
// Run:  ANTHROPIC_API_KEY=sk-... npm start     (or without the key for sample mode)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PORT = Number(process.env.PORT || 8787);
const KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = process.env.NURSEPATH_AI_MODEL || 'claude-sonnet-5-5';
const MAX_BODY = 4_000;
const API_BASE = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

const MODES = {
  plain: 'a plain-language explanation in 2-4 short paragraphs',
  steps: 'a numbered step-by-step breakdown',
  analogy: 'an everyday analogy, then a short note on where the analogy breaks down',
  compare: 'a comparison table in Markdown, followed by one sentence summarizing the key difference',
  scenario: 'a brief FICTIONAL nursing scenario (clearly labeled fictional, no real people) followed by 2-3 clinical reasoning questions with discussion',
  quiz: 'three multiple-choice practice questions, each with the correct answer and a rationale',
};

const SYSTEM = `You are the study helper inside NursePath, an independent educational tool for U.S. nursing students (ADN/BSN).
Rules:
- Explain nursing concepts accurately at a first-year nursing student level, in plain language.
- Do NOT give medication dosing, dose calculations for real patients, or individualized clinical advice.
- Use only fictional scenarios. If the user includes anything that looks like real patient information, do not use it and remind them not to share it.
- Do not invent citations, references, statistics, URLs, or quotes. Do not cite sources at all; suggest the student check their textbook, faculty, or official guidance.
- Say when practice can vary by facility policy or textbook.
- Do not claim that studying or quiz performance demonstrates clinical competence.
- Keep the answer under 450 words.`;

// Very small rate limit: 20 requests per minute per address.
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 20;
}

function json(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw new Error('too large');
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

async function explain(req, res) {
  if (!KEY) return json(res, 503, { error: 'Live AI is not configured on this server.' });
  if (limited(req.socket.remoteAddress || 'x')) return json(res, 429, { error: 'Too many requests. Wait a minute and try again.' });
  let body;
  try { body = await readBody(req); } catch { return json(res, 400, { error: 'The request was too large or not valid.' }); }
  const topic = String(body.topic || '').slice(0, 120).trim();
  const mode = MODES[body.mode] ? body.mode : 'plain';
  const question = String(body.question || '').slice(0, 300).trim();
  if (!topic) return json(res, 400, { error: 'Enter a concept to explain.' });

  const user = `Concept: ${topic}\nFormat: ${MODES[mode]}${question ? `\nStudent's specific question: ${question}` : ''}`;
  try {
    const r = await fetch(`${API_BASE}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 900, system: SYSTEM, messages: [{ role: 'user', content: user }] }),
    });
    if (!r.ok) {
      console.error('AI error', r.status, await r.text().catch(() => ''));
      return json(res, 502, { error: 'The AI service returned an error. Try again later, or use the sample library.' });
    }
    const data = await r.json();
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    return json(res, 200, { text: text || 'No answer was returned.' });
  } catch (e) {
    console.error('AI request failed', e);
    return json(res, 502, { error: 'Could not reach the AI service. Check the server’s internet connection.' });
  }
}

async function serveStatic(req, res) {
  const url = new URL(req.url, 'http://x');
  let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  if (path === '/' || path === '\\') path = '/index.html';
  const file = join(ROOT, path);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  try {
    const s = await stat(file);
    if (!s.isFile()) throw new Error();
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch {
    try {
      res.writeHead(200, { 'Content-Type': TYPES['.html'] });
      res.end(await readFile(join(ROOT, 'index.html')));
    } catch {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('The app has not been built yet. Run "npm run build" first.');
    }
  }
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://x');
  if (pathname.endsWith('/api/ai/status')) {
    return json(res, 200, KEY ? { available: true, model: MODEL } : { available: false, message: 'The NursePath server is running, but no AI key is configured.' });
  }
  if (pathname.endsWith('/api/ai/explain') && req.method === 'POST') return explain(req, res);
  if (pathname.includes('/api/')) return json(res, 404, { error: 'Not found' });
  return serveStatic(req, res);
}).listen(PORT, () => {
  console.log(`NursePath running at http://localhost:${PORT}  (live AI: ${KEY ? 'on' : 'off — sample mode'})`);
});

// src/guard.js — protezioni per il deploy pubblico: rate-limit per-IP + Turnstile.
// INERTI di default: senza le env (RATE_LIMIT_ON / TURNSTILE_SECRET) non bloccano nulla,
// quindi in locale il comportamento è identico a ora. Si attivano solo in produzione.
// ponytail: stato rate-limit IN-MEMORY → ok per un'istanza singola; su serverless
// ponytail: multi-istanza serve un KV condiviso (Vercel KV / Upstash). Vedi README.

const HITS = new Map(); // ip -> number[] (timestamp in ms)

// Sliding window per IP. `now` iniettabile per i test (niente dipendenza dall'orologio).
export function rateLimit(ip, { limit = 20, windowMs = 60000, now = Date.now() } = {}) {
  if (!ip) return { ok: true, remaining: limit };
  const arr = (HITS.get(ip) || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    HITS.set(ip, arr);
    return { ok: false, remaining: 0, retryAfter: Math.ceil((windowMs - (now - arr[0])) / 1000) };
  }
  arr.push(now);
  HITS.set(ip, arr);
  return { ok: true, remaining: limit - arr.length };
}

// Verifica il token Turnstile lato server. Senza secret → no-op (inerte): non blocca.
export async function verifyTurnstile(token, secret) {
  if (!secret) return { ok: true, skipped: true };
  if (!token) return { ok: false, reason: 'token mancante' };
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = await res.json();
    return { ok: !!data.success, reason: data.success ? null : (data['error-codes'] || []).join(',') };
  } catch (e) {
    return { ok: false, reason: String(e).slice(0, 80) };
  }
}

// Helper unico per gli endpoint: ritorna una Response di blocco, oppure null se via libera.
// Entrambe le protezioni sono gate-ate dalle env → senza config, ritorna sempre null.
export async function guard(req, body) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    || req.headers.get('x-real-ip') || 'local';

  if (process.env.RATE_LIMIT_ON) {
    const rl = rateLimit(ip, { limit: Number(process.env.RATE_LIMIT) || 20 });
    if (!rl.ok) {
      return Response.json({ error: 'Troppe richieste, riprova tra poco.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } });
    }
  }
  const tv = await verifyTurnstile(body && body.turnstileToken, process.env.TURNSTILE_SECRET);
  if (!tv.ok) return Response.json({ error: 'Verifica anti-bot non superata.' }, { status: 403 });

  return null; // via libera
}

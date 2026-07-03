// app/api/llms/route.js — genera e restituisce il llms.txt di un sito (testo scaricabile).
import { audit } from 'beacon-geo/audit';
import { generateLlmsTxt } from 'beacon-geo/llmstxt';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON non valido' }, { status: 400 }); }
  const { url } = body || {};
  if (!url) return Response.json({ error: 'Indirizzo del sito mancante' }, { status: 400 });
  try {
    const r = await audit(url);
    const txt = generateLlmsTxt(r.html, r.url);
    return new Response(txt, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  } catch (e) {
    return Response.json({ error: 'Generazione fallita: ' + String(e).slice(0, 120) }, { status: 500 });
  }
}

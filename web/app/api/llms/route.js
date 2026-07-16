// app/api/llms/route.js — genera e restituisce il llms.txt di un sito (testo scaricabile).
// i18n (fase 2): VOLUTAMENTE senza `lang`. Il llms.txt è un artefatto da pubblicare sul
// sito del proprietario: la sua lingua deve seguire il sito, non la UI di chi lo genera.
// Le intestazioni generate restano in italiano (lingua base di Beacon) finché non
// esisterà una rilevazione della lingua del sito analizzato.
import { audit } from 'beacon-geo/audit';
import { generateLlmsTxt } from 'beacon-geo/llmstxt';
import { guard } from 'beacon-geo/guard';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON non valido' }, { status: 400 }); }
  const { url } = body || {};
  if (!url) return Response.json({ error: 'Indirizzo del sito mancante' }, { status: 400 });
  const blocked = await guard(req, body); if (blocked) return blocked;
  try {
    const r = await audit(url);
    const txt = generateLlmsTxt(r.html, r.url);
    return new Response(txt, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  } catch (e) {
    return Response.json({ error: 'Generazione fallita: ' + String(e).slice(0, 120) }, { status: 500 });
  }
}

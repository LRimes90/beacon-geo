// app/api/llms/route.js — genera e restituisce il llms.txt di un sito (testo scaricabile).
// i18n (fase 2): VOLUTAMENTE senza `lang`. Il llms.txt è un artefatto da pubblicare sul
// sito del proprietario: la sua lingua deve seguire il sito, non la UI di chi lo genera.
// Le intestazioni generate restano in italiano (lingua base di Beacon) finché non
// esisterà una rilevazione della lingua del sito analizzato.
import { audit } from 'beacon-geo/audit';
import { generateLlmsTxt } from 'beacon-geo/llmstxt';
import { guard } from 'beacon-geo/guard';
import { reqLang, fail, failFromError } from '../http.js';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return fail(reqLang(req), 'api.badJson', 400); }
  const { url } = body || {};
  const l = reqLang(req, body);
  // typeof: le altre route lo controllano già. Senza, un numero o un oggetto
  // arrivava fino al motore e usciva come 500 («e.trim is not a function»).
  if (!url || typeof url !== 'string') return fail(l, 'url.missing', 400);
  const blocked = await guard(req, body); if (blocked) return blocked;
  try {
    const r = await audit(url);
    // Sito non scaricato = niente HTML da cui derivare titoli e sezioni. Senza
    // questo controllo la risposta era un 200 con un file plausibile ma vuoto
    // («# 127», nessuna sezione): l'utente lo pubblicava credendolo buono.
    // 424 e non 502 per lo stesso motivo dell'AI Act: Cloudflare sostituisce il
    // corpo di ogni 5xx dell'origine, i 4xx passano intatti.
    if (!r.fetchedOk) return fail(l, 'api.unreachable', 424);
    const txt = generateLlmsTxt(r.html, r.url);
    return new Response(txt, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  } catch (e) {
    // Input sbagliato = 400 col motivo tradotto; imprevisto = 500 generico + log.
    return failFromError(l, e, 'api/llms');
  }
}

// app/api/audit/route.js — API che espone il motore Beacon.
// Riusa audit() dal pacchetto motore (../..): niente logica duplicata qui.
import { audit } from 'beacon-geo/audit';
import { guard } from 'beacon-geo/guard';
import { reqLang, fail, failFromError } from '../http.js';

export const runtime = 'nodejs';      // serve il runtime Node (fetch server-side, Playwright opzionale)
export const maxDuration = 60;         // le analisi possono durare qualche secondo
export const dynamic = 'force-dynamic';

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return fail(reqLang(req), 'api.badJson', 400); }
  const { url, renderJs } = body || {};
  const l = reqLang(req, body);
  if (!url || typeof url !== 'string') return fail(l, 'url.missing', 400);
  const blocked = await guard(req, body); if (blocked) return blocked;
  try {
    // lang: whitelist it/en/de/fr/es/pt (qualunque altro valore → 'it')
    const r = await audit(url, { renderJs: !!renderJs, lang: l });
    const { html, ...rest } = r; // non rispedire l'HTML grezzo al client
    return Response.json(rest);
  } catch (e) {
    // Indirizzo scritto male = colpa dell'input (400, motivo tradotto); il resto
    // è un imprevisto: 500 generico all'utente, testo completo nei log.
    return failFromError(l, e, 'api/audit');
  }
}

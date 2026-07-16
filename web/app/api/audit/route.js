// app/api/audit/route.js — API che espone il motore Beacon.
// Riusa audit() dal pacchetto motore (../..): niente logica duplicata qui.
import { audit } from 'beacon-geo/audit';
import { guard } from 'beacon-geo/guard';

export const runtime = 'nodejs';      // serve il runtime Node (fetch server-side, Playwright opzionale)
export const maxDuration = 60;         // le analisi possono durare qualche secondo
export const dynamic = 'force-dynamic';

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON non valido' }, { status: 400 }); }
  const { url, renderJs } = body || {};
  if (!url || typeof url !== 'string') return Response.json({ error: 'Indirizzo del sito mancante' }, { status: 400 });
  const blocked = await guard(req, body); if (blocked) return blocked;
  try {
    const r = await audit(url, { renderJs: !!renderJs });
    const { html, ...rest } = r; // non rispedire l'HTML grezzo al client
    return Response.json(rest);
  } catch (e) {
    return Response.json({ error: 'Analisi fallita: ' + String(e).slice(0, 120) }, { status: 500 });
  }
}

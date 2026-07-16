// app/api/a11y/route.js — endpoint del modulo Accessibilità (companion, separato dal GEO).
// Riusa auditA11y() dal motore: nessuna logica duplicata qui.
import { auditA11y } from 'beacon-geo/a11y';
import { guard } from 'beacon-geo/guard';
import { normalizeLang } from 'beacon-geo/messages';

export const runtime = 'nodejs';
export const maxDuration = 60;      // la scansione axe con rendering può durare qualche secondo
export const dynamic = 'force-dynamic';

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON non valido' }, { status: 400 }); }
  const { url, deep, lang } = body || {};
  if (!url || typeof url !== 'string') return Response.json({ error: 'Indirizzo del sito mancante' }, { status: 400 });
  const blocked = await guard(req, body); if (blocked) return blocked;
  try {
    // lang: whitelist it/en/de/fr/es/pt (qualunque altro valore → 'it')
    const r = await auditA11y(url, { deep: !!deep, lang: normalizeLang(lang) });
    return Response.json(r);
  } catch (e) {
    return Response.json({ error: 'Analisi fallita: ' + String(e).slice(0, 120) }, { status: 500 });
  }
}

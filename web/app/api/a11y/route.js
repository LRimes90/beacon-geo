// app/api/a11y/route.js — endpoint del modulo Accessibilità (companion, separato dal GEO).
// Riusa auditA11y() dal motore: nessuna logica duplicata qui.
import { auditA11y } from 'beacon-geo/a11y';
import { guard } from 'beacon-geo/guard';
import { reqLang, fail, failFromError } from '../http.js';

export const runtime = 'nodejs';
export const maxDuration = 60;      // la scansione axe con rendering può durare qualche secondo
export const dynamic = 'force-dynamic';

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return fail(reqLang(req), 'api.badJson', 400); }
  const { url, deep } = body || {};
  const l = reqLang(req, body);
  if (!url || typeof url !== 'string') return fail(l, 'url.missing', 400);
  const blocked = await guard(req, body); if (blocked) return blocked;
  try {
    // lang: whitelist it/en/de/fr/es/pt (qualunque altro valore → 'it')
    const r = await auditA11y(url, { deep: !!deep, lang: l });
    return Response.json(r);
  } catch (e) {
    // Input sbagliato = 400 col motivo tradotto; imprevisto = 500 generico + log.
    return failFromError(l, e, 'api/a11y');
  }
}

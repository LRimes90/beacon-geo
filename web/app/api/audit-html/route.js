// app/api/audit-html/route.js — audit GEO su snapshot HTML fornito dal chiamante.
// Serve per contenuti non ancora pubblici, ad esempio bozze WordPress lette via REST.
import { auditHtmlSnapshot } from 'beacon-geo/audit';
import { guard } from 'beacon-geo/guard';
import { normalizeLang } from 'beacon-geo/messages';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON non valido' }, { status: 400 }); }
  const { url, html, lang } = body || {};
  if (!url || typeof url !== 'string') return Response.json({ error: 'URL canonica mancante' }, { status: 400 });
  if (!html || typeof html !== 'string') return Response.json({ error: 'HTML mancante' }, { status: 400 });
  if (html.length > 1_000_000) return Response.json({ error: 'HTML troppo grande' }, { status: 413 });

  const blocked = await guard(req, body);
  if (blocked) return blocked;

  try {
    const r = await auditHtmlSnapshot(url, html, { lang: normalizeLang(lang) });
    const { html: _html, ...rest } = r;
    return Response.json(rest);
  } catch (e) {
    return Response.json({ error: 'Analisi snapshot fallita: ' + String(e).slice(0, 120) }, { status: 500 });
  }
}

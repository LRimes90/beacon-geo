// app/api/audit-html/route.js — audit GEO su snapshot HTML fornito dal chiamante.
// Serve per contenuti non ancora pubblici, ad esempio bozze WordPress lette via REST.
import { auditHtmlSnapshot } from 'beacon-geo/audit';
import { guard } from 'beacon-geo/guard';
import { reqLang, fail, failFromError } from '../http.js';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return fail(reqLang(req), 'api.badJson', 400); }
  const { url, html } = body || {};
  const l = reqLang(req, body);
  if (!url || typeof url !== 'string') return fail(l, 'api.canonicalMissing', 400);
  if (!html || typeof html !== 'string') return fail(l, 'api.htmlMissing', 400);
  if (html.length > 1_000_000) return fail(l, 'api.htmlTooBig', 413);

  const blocked = await guard(req, body);
  if (blocked) return blocked;

  try {
    const r = await auditHtmlSnapshot(url, html, { lang: l });
    const { html: _html, ...rest } = r;
    return Response.json(rest);
  } catch (e) {
    // Input sbagliato = 400 col motivo tradotto; imprevisto = 500 generico + log.
    return failFromError(l, e, 'api/audit-html');
  }
}

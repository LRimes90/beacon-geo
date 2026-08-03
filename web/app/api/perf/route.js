// app/api/perf/route.js — endpoint del modulo Performance (companion, PageSpeed Insights).
import { auditPerf } from 'beacon-geo/perf';
import { guard } from 'beacon-geo/guard';
import { reqLang, fail, failFromError } from '../http.js';

export const runtime = 'nodejs';
export const maxDuration = 60;      // PSI può impiegare 20-40s
export const dynamic = 'force-dynamic';

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return fail(reqLang(req), 'api.badJson', 400); }
  const { url, strategy } = body || {};
  const l = reqLang(req, body);
  if (!url || typeof url !== 'string') return fail(l, 'url.missing', 400);
  const blocked = await guard(req, body); if (blocked) return blocked;
  try {
    // la chiave PSI, se presente nell'ambiente, alza solo i rate limit (opzionale)
    // lang (whitelist it/en/de/fr/es/pt) → locale PSI: Google traduce displayValue e opportunità
    const r = await auditPerf(url, { strategy: strategy === 'desktop' ? 'desktop' : 'mobile', key: process.env.PAGESPEED_KEY, lang: l });
    return Response.json(r);
  } catch (e) {
    // Input sbagliato = 400 col motivo tradotto; imprevisto = 500 generico + log.
    return failFromError(l, e, 'api/perf');
  }
}

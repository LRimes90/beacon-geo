// app/api/perf/route.js — endpoint del modulo Performance (companion, PageSpeed Insights).
import { auditPerf } from 'beacon-geo/perf';
import { guard } from 'beacon-geo/guard';
import { normalizeLang } from 'beacon-geo/messages';

export const runtime = 'nodejs';
export const maxDuration = 60;      // PSI può impiegare 20-40s
export const dynamic = 'force-dynamic';

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON non valido' }, { status: 400 }); }
  const { url, strategy, lang } = body || {};
  if (!url || typeof url !== 'string') return Response.json({ error: 'Indirizzo del sito mancante' }, { status: 400 });
  const blocked = await guard(req, body); if (blocked) return blocked;
  try {
    // la chiave PSI, se presente nell'ambiente, alza solo i rate limit (opzionale)
    // lang (whitelist it/en/de/fr/es/pt) → locale PSI: Google traduce displayValue e opportunità
    const r = await auditPerf(url, { strategy: strategy === 'desktop' ? 'desktop' : 'mobile', key: process.env.PAGESPEED_KEY, lang: normalizeLang(lang) });
    return Response.json(r);
  } catch (e) {
    return Response.json({ error: 'Analisi fallita: ' + String(e).slice(0, 120) }, { status: 500 });
  }
}

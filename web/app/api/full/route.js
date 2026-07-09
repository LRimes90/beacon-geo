// app/api/full/route.js — scansione unica: GEO + a11y (deep) + performance.
import { auditAll } from 'beacon-geo/suite';

export const runtime = 'nodejs';
export const maxDuration = 90;      // 3 tool in parallelo, alcuni lanciano Chromium/PSI
export const dynamic = 'force-dynamic';

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON non valido' }, { status: 400 }); }
  const { url, renderJs, strategy } = body || {};
  if (!url || typeof url !== 'string') return Response.json({ error: 'Indirizzo del sito mancante' }, { status: 400 });
  try {
    const r = await auditAll(url, { renderJs: !!renderJs, strategy: strategy === 'desktop' ? 'desktop' : 'mobile', psiKey: process.env.PAGESPEED_KEY });
    if (r.geo && r.geo.html) delete r.geo.html; // non rispedire l'HTML grezzo
    return Response.json(r);
  } catch (e) {
    return Response.json({ error: 'Scansione fallita: ' + String(e).slice(0, 120) }, { status: 500 });
  }
}

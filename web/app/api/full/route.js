// app/api/full/route.js — scansione unica: GEO + a11y (deep) + performance.
import { auditAll } from 'beacon-geo/suite';
import { snapshot, diff, saveSnapshot, loadHistory } from 'beacon-geo/history';
import { join } from 'node:path';

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
    // storico: confronto con la scansione precedente (before-after). Non critico: se fallisce, il risultato esce comunque.
    try {
      const dir = join(process.cwd(), '.beacon-history');
      const hist = await loadHistory(dir, r.host);
      const previous = hist.length ? hist[hist.length - 1] : null;
      const snap = snapshot(r, new Date().toISOString());
      await saveSnapshot(dir, snap);
      r.history = { count: hist.length + 1, previous, delta: diff(previous, snap) };
    } catch { /* storico non disponibile: si prosegue senza */ }
    return Response.json(r);
  } catch (e) {
    return Response.json({ error: 'Scansione fallita: ' + String(e).slice(0, 120) }, { status: 500 });
  }
}

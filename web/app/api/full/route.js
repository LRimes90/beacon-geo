// app/api/full/route.js — scansione unica: GEO + a11y (deep) + performance.
import { auditAll } from 'beacon-geo/suite';
import { snapshot, diff, saveSnapshot, loadHistory } from 'beacon-geo/history';
import { join } from 'node:path';
import { guard } from 'beacon-geo/guard';
import { reqLang, fail, failFromError } from '../http.js';

export const runtime = 'nodejs';
export const maxDuration = 90;      // 3 tool in parallelo, alcuni lanciano Chromium/PSI
export const dynamic = 'force-dynamic';

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return fail(reqLang(req), 'api.badJson', 400); }
  const { url, renderJs, strategy } = body || {};
  const l = reqLang(req, body);
  if (!url || typeof url !== 'string') return fail(l, 'url.missing', 400);
  const blocked = await guard(req, body); if (blocked) return blocked;
  try {
    // lang: whitelist it/en/de/fr/es/pt (qualunque altro valore → 'it'), propagata ai 3 tool
    const r = await auditAll(url, { renderJs: !!renderJs, strategy: strategy === 'desktop' ? 'desktop' : 'mobile', psiKey: process.env.PAGESPEED_KEY, lang: l });
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
    // Input sbagliato = 400 col motivo tradotto; imprevisto = 500 generico + log.
    return failFromError(l, e, 'api/full');
  }
}

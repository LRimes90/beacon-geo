// src/history.js — storico scansioni + confronto before-after (la "prova del ROI").
// snapshot()/diff() sono PURE (testabili); save/load fanno I/O su file JSON.
// ponytail: storage su file JSON, non un DB — sufficiente per uso locale/self-host.
// ponytail: su serverless il filesystem è effimero → sostituire con KV/SQLite al deploy (leva #3).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const MAX = 50; // teniamo le ultime N scansioni per host
const safe = (host) => String(host || 'sito').replace(/[^a-z0-9.-]/gi, '_');

// Estrae uno snapshot compatto (solo i punteggi) dal risultato di auditAll().
export function snapshot(suite, ts) {
  const geo = suite.geo && !suite.geo.error ? suite.geo.overall : null;
  const a11y = suite.a11y && !suite.a11y.error && suite.a11y.result ? suite.a11y.result.score : null;
  const axe = suite.a11y && suite.a11y.axe && suite.a11y.axe.ok ? suite.a11y.axe.counts.violations : null;
  const perf = suite.perf && suite.perf.ok ? suite.perf.result.score : null;
  return { ts, host: suite.host, url: suite.url, geo, a11y, axe, perf };
}

// Delta tra due snapshot. Per i punteggi: positivo = meglio. Per axe (violazioni): negativo = meglio.
export function diff(prev, curr) {
  if (!prev || !curr) return null;
  const d = {};
  for (const k of ['geo', 'a11y', 'perf']) {
    if (typeof prev[k] === 'number' && typeof curr[k] === 'number') d[k] = curr[k] - prev[k];
  }
  if (typeof prev.axe === 'number' && typeof curr.axe === 'number') d.axe = curr.axe - prev.axe;
  return d;
}

export async function loadHistory(dir, host) {
  try {
    const raw = await readFile(join(dir, safe(host) + '.json'), 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export async function saveSnapshot(dir, snap) {
  await mkdir(dir, { recursive: true });
  const hist = await loadHistory(dir, snap.host);
  hist.push(snap);
  const trimmed = hist.slice(-MAX);
  await writeFile(join(dir, safe(snap.host) + '.json'), JSON.stringify(trimmed, null, 2));
  return trimmed;
}

// src/perf.js — modulo PERFORMANCE / Core Web Vitals (companion, terzo tool).
// Usa l'API PageSpeed Insights di Google: ritorna il PUNTEGGIO LIGHTHOUSE reale
// (così combacia con la garanzia "Lighthouse >90") + i CWV in laboratorio.
// Zero dipendenze: una GET a Google. La API key è OPZIONALE (solo per alzare i rate limit).
// ponytail: PSI invece di far girare Lighthouse in locale — niente dep pesante, punteggio ufficiale.

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

// soglie Google: [good_max, needs-improvement_max]; oltre = poor
function metric(audits, id, name) {
  const a = audits[id];
  if (!a || a.numericValue == null) return null;
  const v = a.numericValue;
  const T = {
    'largest-contentful-paint': [2500, 4000],
    'cumulative-layout-shift': [0.1, 0.25],
    'total-blocking-time': [200, 600],
    'first-contentful-paint': [1800, 3000],
    'speed-index': [3400, 5800],
  }[id];
  const status = v <= T[0] ? 'good' : v <= T[1] ? 'warn' : 'crit';
  return { id, name, status, detail: a.displayValue || String(v) };
}

// Mappatura PURA del JSON PageSpeed → riassunto compatto per la UI.
export function summarizePsi(json) {
  const lh = json && json.lighthouseResult;
  if (!lh) return null;
  const audits = lh.audits || {};
  const score = clamp(((lh.categories && lh.categories.performance && lh.categories.performance.score) || 0) * 100);
  const metrics = [
    metric(audits, 'largest-contentful-paint', 'LCP · Largest Contentful Paint'),
    metric(audits, 'cumulative-layout-shift', 'CLS · Cumulative Layout Shift'),
    metric(audits, 'total-blocking-time', 'TBT · Total Blocking Time'),
    metric(audits, 'first-contentful-paint', 'FCP · First Contentful Paint'),
    metric(audits, 'speed-index', 'Speed Index'),
  ].filter(Boolean);
  const opportunities = Object.values(audits)
    .filter((a) => a.details && a.details.type === 'opportunity' && a.details.overallSavingsMs > 0)
    .map((a) => ({ title: a.title, savingsMs: Math.round(a.details.overallSavingsMs) }))
    .sort((a, b) => b.savingsMs - a.savingsMs)
    .slice(0, 6);
  // dati reali degli utenti (CrUX), se disponibili
  const le = json.loadingExperience;
  const field = le && le.overall_category ? { category: le.overall_category } : null;
  return { score, metrics, opportunities, field };
}

// Orchestratore sottile (I/O): interroga PageSpeed Insights.
export async function auditPerf(rawUrl, { strategy = 'mobile', key } = {}) {
  let u = String(rawUrl).trim();
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  const url = new URL(u).href;
  const host = new URL(url).host;
  const api = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=' +
    encodeURIComponent(url) + '&category=performance&strategy=' + strategy + (key ? '&key=' + key : '');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 45000);
  try {
    const res = await fetch(api, { signal: ctrl.signal });
    const json = await res.json();
    if (!res.ok || json.error) {
      return { url, host, strategy, ok: false, reason: (json.error && json.error.message ? json.error.message : 'HTTP ' + res.status).slice(0, 160) };
    }
    return { url, host, strategy, ok: true, result: summarizePsi(json) };
  } catch (e) {
    return { url, host, strategy, ok: false, reason: String(e).slice(0, 160) };
  } finally {
    clearTimeout(t);
  }
}
export const PERF_LABEL = 'Performance';

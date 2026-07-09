// src/suite.js — SCANSIONE UNICA: lancia i 3 tool (GEO + a11y deep + performance)
// in parallelo per un solo URL e ritorna il risultato combinato per il report cliente.
// allSettled: se un tool fallisce (es. PSI senza chiave), gli altri due consegnano comunque.
import { audit } from '../audit.js';
import { auditA11y } from './a11y.js';
import { auditPerf } from './perf.js';

function normUrl(raw) {
  let u = String(raw).trim();
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return new URL(u).href;
}

export async function auditAll(rawUrl, { renderJs = false, strategy = 'mobile', psiKey } = {}) {
  const url = normUrl(rawUrl);
  const host = new URL(url).host;
  const [geo, a11y, perf] = await Promise.allSettled([
    audit(url, { renderJs }),
    auditA11y(url, { deep: true }),
    auditPerf(url, { strategy, key: psiKey }),
  ]);
  const val = (s) => (s.status === 'fulfilled' ? s.value : { error: String(s.reason).slice(0, 140) });
  return { url, host, geo: val(geo), a11y: val(a11y), perf: val(perf) };
}

// src/suite.js — SCANSIONE UNICA: lancia i 3 tool (GEO + a11y deep + performance)
// in parallelo per un solo URL e ritorna il risultato combinato per il report cliente.
// allSettled: se un tool fallisce (es. PSI senza chiave), gli altri due consegnano comunque.
import { audit } from '../audit.js';
import { auditA11y } from './a11y.js';
import { auditPerf } from './perf.js';
import { normUrl } from './lib.js';

// i18n: `lang` (default 'it') viene propagato ai 3 tool e riportato nel risultato,
// così il report scaricabile può riusare la stessa lingua della scansione.
export async function auditAll(rawUrl, { renderJs = false, strategy = 'mobile', psiKey, lang = 'it', desktop = false } = {}) {
  const url = normUrl(rawUrl);
  const host = new URL(url).host;
  // `desktop`: PSI computer in parallelo, per lo switch mobile/computer di /report (istantaneo,
  // tempo totale invariato). Spento di default: il confronto multi-sito non lo usa.
  // Storico e delta restano su `perf` (gli snapshot passati sono mobile).
  const [geo, a11y, perf, perfDesktop] = await Promise.allSettled([
    audit(url, { renderJs, lang }),
    auditA11y(url, { deep: true, lang }),
    auditPerf(url, { strategy, key: psiKey, lang }),
    desktop ? auditPerf(url, { strategy: 'desktop', key: psiKey, lang }) : null,
  ]);
  const val = (s) => (s.status === 'fulfilled' ? s.value : { error: String(s.reason).slice(0, 140) });
  const r = { url, host, lang, geo: val(geo), a11y: val(a11y), perf: val(perf) };
  if (desktop) r.perfDesktop = val(perfDesktop);
  return r;
}

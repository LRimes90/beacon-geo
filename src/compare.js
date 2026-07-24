// src/compare.js — confronto multi-sito: lancia auditAll (GEO + a11y + perf) su N URL
// con un pool a bassa concorrenza (stesso approccio di batch.js). rows[0] = sito di riferimento.
// Un errore su un sito non ferma gli altri: viene marcato e il confronto prosegue.
import { auditAll } from './suite.js';

export async function compareAll(urls, { conc = 3, ...opts } = {}) {
  const results = new Array(urls.length);
  let i = 0;
  async function worker() {
    while (i < urls.length) {
      const idx = i++;
      try {
        results[idx] = await auditAll(urls[idx], opts);
      } catch (e) {
        results[idx] = { url: urls[idx], error: String(e).slice(0, 140) };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(conc, urls.length) }, worker));
  return results;
}

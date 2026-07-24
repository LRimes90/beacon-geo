// src/compareReport.js — report comparativo multi-sito (competitor comparison).
// Prende gli oggetti suite di auditAll() e affianca i 3 punteggi (GEO, a11y, perf)
// del sito di riferimento (il primo) contro i concorrenti. Niente punteggio unico: 3 assi distinti.
// ponytail: stringhe in italiano dirette; se servirà il multilingua, spostarle in messages/.

const AXES = [
  { key: 'geo', label: 'GEO / AI' },
  { key: 'a11y', label: 'Accessibilità' },
  { key: 'perf', label: 'Performance' },
];
const col = (s) => (s == null ? '#8A9896' : s >= 80 ? '#2E8B5F' : s >= 60 ? '#B4841F' : s >= 40 ? '#C77D2E' : '#C0492F');
// esc: iniettiamo l'host dei siti analizzati nel report → confine di fiducia
const esc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// estrazione deterministica dei punteggi da un oggetto suite (stesse condizioni di suiteReport.js)
function pickScores(s) {
  if (!s || s.error) return { host: (s && (s.host || s.url)) || '—', url: s && s.url, geo: null, a11y: null, perf: null };
  return {
    host: s.host,
    url: s.url,
    geo: s.geo && !s.geo.error ? s.geo.overall : null,
    a11y: s.a11y && !s.a11y.error && s.a11y.result ? s.a11y.result.score : null,
    perf: s.perf && s.perf.ok ? s.perf.result.score : null,
  };
}

// TODO(human): decide chi "vince" ogni asse e quanto è indietro il sito di riferimento (rows[0]).
// Firma: axisSummary(rows) dove rows = array di { host, geo, a11y, perf } (punteggi number|null),
// rows[0] è il sito del cliente/di riferimento. Deve ritornare:
//   { best: { geo, a11y, perf }, gaps: { geo, a11y, perf } }
// - best[asse]  = host del sito col punteggio più ALTO su quell'asse (ignora i null; null se nessuno ha il dato)
// - gaps[asse]  = rows[0][asse] − (punteggio del leader su quell'asse)
//                 0 se il target è in testa · negativo se è indietro · null se il dato del target o del leader manca
// Pareggi: vince la PRIMA riga col punteggio massimo → essendo rows[0] il target,
// se pareggia col leader risulta lui "best" (gap 0), senza casi speciali.
function axisSummary(rows) {
  const best = {}, gaps = {};
  for (const { key } of AXES) {
    const valid = rows.map((r) => r[key]).filter((v) => v != null);
    if (!valid.length) { best[key] = null; gaps[key] = null; continue; }
    const max = Math.max(...valid);
    best[key] = rows.find((r) => r[key] === max).host;
    const target = rows[0][key];
    gaps[key] = target == null ? null : target - max;
  }
  return { best, gaps };
}

export function toMarkdownCompare(suites, { brand = 'Beacon' } = {}) {
  const rows = suites.map(pickScores);
  const { best, gaps } = axisSummary(rows);
  const L = [`# ${brand} · Confronto competitor`, '', `Sito di riferimento: **${rows[0].host}**`, ''];
  L.push('| Sito | ' + AXES.map((a) => a.label).join(' | ') + ' |');
  L.push('|---|' + '---|'.repeat(AXES.length));
  rows.forEach((r, i) => {
    const cells = AXES.map((a) => {
      const v = r[a.key];
      const lead = best[a.key] === r.host ? ' 🥇' : '';
      return (v == null ? '—' : v) + lead;
    });
    L.push(`| ${i === 0 ? '**' + r.host + '**' : r.host} | ${cells.join(' | ')} |`);
  });
  L.push('', '## Gap del sito di riferimento vs leader');
  AXES.forEach((a) => {
    const g = gaps[a.key];
    const txt = g == null ? 'dato mancante' : g >= 0 ? `in testa (+${g})` : `${g} punti dal leader (${best[a.key]})`;
    L.push(`- ${a.label}: ${txt}`);
  });
  return L.join('\n');
}

export function toHtmlCompare(suites, { date = '', brand = 'Beacon' } = {}) {
  const rows = suites.map(pickScores);
  const { best, gaps } = axisSummary(rows);
  const head = AXES.map((a) => `<th>${esc(a.label)}</th>`).join('');
  const body = rows.map((r, i) => {
    const cells = AXES.map((a) => {
      const v = r[a.key];
      const win = best[a.key] === r.host;
      return `<td class="n" style="color:${col(v)}${win ? ';font-weight:700' : ''}">${v == null ? '—' : v}${win ? ' <span class="win">★</span>' : ''}</td>`;
    }).join('');
    return `<tr${i === 0 ? ' class="target"' : ''}><td>${esc(r.host)}${i === 0 ? ' <span class="you">rif.</span>' : ''}</td>${cells}</tr>`;
  }).join('');
  const gapItems = AXES.map((a) => {
    const g = gaps[a.key];
    const txt = g == null ? 'dato mancante' : g >= 0 ? `in testa (+${g})` : `${g} dal leader (${esc(best[a.key])})`;
    return `<li>${esc(a.label)}: ${txt}</li>`;
  }).join('');
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>${esc(brand)} · Confronto</title>
<style>
  body{font:14.5px/1.6 system-ui,-apple-system,Segoe UI,sans-serif;color:#16221F;max-width:760px;margin:28px auto;padding:0 20px}
  .eyebrow{font:600 12px/1 ui-monospace,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:#0E6E6B}
  h1{font:700 26px/1.2 Georgia,serif;margin:.2em 0}
  .meta{color:#5C6B69;font-size:13px;margin:.4em 0 1.4em}
  table{border-collapse:collapse;width:100%;margin:12px 0}
  th,td{padding:9px;border-bottom:1px solid #E2E8E8;text-align:left}
  th{font:600 11px ui-monospace,monospace;letter-spacing:.06em;text-transform:uppercase;color:#5C6B69}
  td.n{font:700 14px ui-monospace,monospace}
  tr.target{background:#F1F7F5}
  .you,.win{font:600 10px ui-monospace,monospace;color:#0E6E6B}
  h2{font:600 18px Georgia,serif;margin:1.6em 0 .3em;border-top:1px solid #E2E8E8;padding-top:1em}
  ul{padding-left:1.1em} li{margin:.35em 0}
  footer{margin-top:2em;color:#8A9896;font-size:12px;border-top:1px solid #E2E8E8;padding-top:10px}
</style></head><body>
  <div class="eyebrow">Beacon · Confronto competitor</div>
  <h1>${esc(rows[0].host)}</h1>
  <div class="meta">vs ${rows.length - 1} concorrenti${date ? ' · ' + esc(date) : ''}</div>
  <table><thead><tr><th>Sito</th>${head}</tr></thead><tbody>${body}</tbody></table>
  <h2>Gap del sito di riferimento</h2>
  <ul>${gapItems}</ul>
  <footer>${esc(brand)} — 3 misure indipendenti, nessun punteggio unico.</footer>
</body></html>`;
}

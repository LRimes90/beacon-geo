// src/suiteReport.js — report cliente-ready COMBINATO (GEO + a11y + performance).
// Funzioni pure: prendono il risultato di auditAll() e ritornano HTML/Markdown brandizzati.
// Niente punteggio unico: 3 misure diverse → 3 punteggi affiancati (onestà).
import { normalize, verdict } from './report.js';
import { CATEGORY_LABELS } from './analyzers.js';

const col = (s) => (s >= 80 ? '#2E8B5F' : s >= 60 ? '#B4841F' : s >= 40 ? '#C77D2E' : '#C0492F');
const colPerf = (s) => (s >= 90 ? '#2E8B5F' : s >= 50 ? '#B4841F' : '#C0492F');
const colSt = (st) => (st === 'good' ? '#2E8B5F' : st === 'crit' ? '#C0492F' : '#B4841F');
// escape: nel report iniettiamo HTML del sito analizzato → confine di fiducia
const esc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---- sezioni HTML ----
function geoSection(geo) {
  if (!geo || geo.error) return `<h2>GEO / AI-readiness</h2><p class="muted">Non disponibile: ${esc(geo && geo.error)}</p>`;
  const d = normalize(geo);
  const rows = Object.entries(CATEGORY_LABELS).map(([k, label]) => {
    const s = d.scores[k];
    return `<tr><td>${label}</td><td class="n" style="color:${col(s)}">${s}</td><td><div class="bar"><i style="width:${s}%;background:${col(s)}"></i></div></td></tr>`;
  }).join('');
  return `<h2>GEO / AI-readiness — ${d.overall}/100 <span class="v">${verdict(d.overall)}</span></h2><table>${rows}</table>`;
}

function a11ySection(a) {
  if (!a || a.error) return `<h2>Accessibilità</h2><p class="muted">Non disponibile: ${esc(a && a.error)}</p>`;
  const st = a.result;
  let html = `<h2>Accessibilità — ${st ? st.score : '?'}/100 <span class="v">controlli statici</span></h2>`;
  const crit = (st && st.checks ? st.checks : []).filter((c) => c.status !== 'good' && c.status !== 'info');
  html += crit.length
    ? `<ul>${crit.map((c) => `<li>${esc(c.name)} — ${esc(c.detail)}${c.fix ? `<br><span class="fix">→ ${esc(c.fix)}</span>` : ''}</li>`).join('')}</ul>`
    : '<p>Controlli statici di base superati.</p>';
  const axe = a.axe;
  if (axe && axe.ok) {
    html += `<h3>axe-core — ${axe.counts.violations} violazioni · ${axe.counts.passes} passati · ${axe.counts.incomplete} da verificare</h3>`;
    html += axe.findings.map((f) => {
      const r = f.remedy || {};
      let b = `<div class="finding"><b style="color:${colSt(f.status)}">${esc(f.help)}</b> <span class="tag">${esc(f.impact)} · ${f.nodes} el</span>`;
      if (f.failureSummary) b += `<pre class="fsum">${esc(f.failureSummary)}</pre>`;
      if (r.before) b += `<div class="ba"><span class="bl">prima</span><pre>${esc(r.before)}</pre></div>`;
      if (r.after) b += `<div class="ba"><span class="al">dopo</span><pre>${esc(r.after)}</pre></div>`;
      else b += `<p class="fix">Dettaglio: ${esc(f.helpUrl)}</p>`;
      return b + '</div>';
    }).join('');
  } else if (axe && !axe.ok) {
    html += `<p class="muted">Scansione axe non disponibile: ${esc(axe.reason)}</p>`;
  }
  html += `<p class="disclaimer">⚠️ Il test automatico copre ~metà dei criteri WCAG. Navigazione da tastiera, screen reader e senso del contenuto richiedono verifica umana. Questo non è un audit di conformità.</p>`;
  return html;
}

function perfSection(p) {
  if (!p || p.error) return `<h2>Performance</h2><p class="muted">Non disponibile: ${esc(p && p.error)}</p>`;
  if (!p.ok) return `<h2>Performance</h2><p class="muted">Non disponibile: ${esc(p.reason)}</p>`;
  const r = p.result;
  const metrics = r.metrics.map((m) => `<tr><td>${esc(m.name)}</td><td class="n" style="color:${colSt(m.status)}">${esc(m.detail)}</td></tr>`).join('');
  const opp = r.opportunities.length
    ? `<h3>Dove guadagnare velocità</h3><ul>${r.opportunities.map((o) => `<li>${esc(o.title)} <span class="muted">(~${(o.savingsMs / 1000).toFixed(1)}s)</span></li>`).join('')}</ul>`
    : '';
  return `<h2>Performance — ${r.score}/100 <span class="v">Lighthouse${p.strategy ? ' · ' + esc(p.strategy) : ''}</span></h2><table>${metrics}</table>${opp}`;
}

function card(label, score, sub, c) {
  return `<div class="card"><div class="cl">${esc(label)}</div><div class="cs" style="color:${c}">${score == null ? '—' : score}${score == null ? '' : '<small>/100</small>'}</div><div class="csub">${esc(sub)}</div></div>`;
}

export function toHtmlSuite(suite, { date = '', brand = 'Beacon' } = {}) {
  const geoScore = suite.geo && !suite.geo.error ? suite.geo.overall : null;
  const a11yScore = suite.a11y && !suite.a11y.error && suite.a11y.result ? suite.a11y.result.score : null;
  const axeV = suite.a11y && suite.a11y.axe && suite.a11y.axe.ok ? suite.a11y.axe.counts.violations : null;
  const perfScore = suite.perf && suite.perf.ok ? suite.perf.result.score : null;
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>${esc(brand)} · ${esc(suite.host)}</title>
<style>
  @page{margin:16mm}
  body{font:14.5px/1.6 system-ui,-apple-system,Segoe UI,sans-serif;color:#16221F;max-width:760px;margin:28px auto;padding:0 20px}
  .eyebrow{font:600 12px/1 ui-monospace,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:#0E6E6B}
  h1{font:700 26px/1.2 Georgia,serif;margin:.2em 0}
  .meta{color:#5C6B69;font-size:13px;margin:.4em 0 1.4em}
  .cards{display:flex;gap:12px;margin:0 0 8px}
  .card{flex:1;border:1px solid #E2E8E8;border-radius:10px;padding:14px 16px}
  .cl{font:600 11px/1 ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:#5C6B69}
  .cs{font:700 40px/1.1 Georgia,serif;margin:.15em 0}
  .cs small{font:600 14px ui-monospace,monospace;color:#8A9896}
  .csub{font-size:12px;color:#5C6B69}
  h2{font:600 18px Georgia,serif;margin:1.8em 0 .3em;border-top:1px solid #E2E8E8;padding-top:1em}
  h2 .v{font:600 12px ui-monospace,monospace;color:#8A9896}
  h3{font:600 14px Georgia,serif;margin:1.1em 0 .3em}
  table{border-collapse:collapse;width:100%;margin:10px 0}
  td{padding:8px;border-bottom:1px solid #E2E8E8;vertical-align:middle}
  td.n{font:700 14px ui-monospace,monospace;text-align:right;white-space:nowrap}
  .bar{height:7px;border-radius:4px;background:#EEF3F2;overflow:hidden}
  .bar i{display:block;height:100%;border-radius:4px}
  ul{padding-left:1.1em} li{margin:.35em 0}
  .fix{color:#0E6E6B;font-size:13px}
  .muted{color:#8A9896} .v{color:#8A9896}
  .finding{margin:10px 0;padding:10px 12px;border:1px solid #E2E8E8;border-radius:8px}
  .tag{font:600 11px ui-monospace,monospace;color:#8A9896}
  pre{margin:6px 0 0;padding:8px 10px;background:#F4F7F6;border:1px solid #E2E8E8;border-radius:6px;font:12px/1.5 ui-monospace,monospace;white-space:pre-wrap;word-break:break-word}
  pre.fsum{color:#5C6B69;border-left:3px solid #B4841F}
  .ba{margin-top:6px} .ba .bl,.ba .al{font:700 9px ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase;padding:2px 6px;border-radius:4px}
  .ba .bl{color:#C0492F;background:#FBEAE6} .ba .al{color:#2E8B5F;background:#E7F4EC}
  .disclaimer{font-size:12.5px;color:#5C6B69;background:#FBF6EC;border-left:3px solid #B4841F;padding:9px 12px;border-radius:6px;margin-top:10px}
  footer{margin-top:2em;color:#8A9896;font-size:12px;border-top:1px solid #E2E8E8;padding-top:10px}
</style></head><body>
  <div class="eyebrow">Report completo — GEO · Accessibilità · Performance</div>
  <h1>${esc(suite.host)}</h1>
  <div class="meta">${esc(suite.url)}${date ? ' · ' + esc(date) : ''}</div>
  <div class="cards">
    ${card('GEO / AI', geoScore, geoScore == null ? 'n/d' : verdict(geoScore), geoScore == null ? '#8A9896' : col(geoScore))}
    ${card('Accessibilità', a11yScore, axeV == null ? 'solo statico' : axeV + ' violazioni axe', a11yScore == null ? '#8A9896' : col(a11yScore))}
    ${card('Performance', perfScore, perfScore == null ? 'chiave PSI mancante' : 'Lighthouse', perfScore == null ? '#8A9896' : colPerf(perfScore))}
  </div>
  ${geoSection(suite.geo)}
  ${a11ySection(suite.a11y)}
  ${perfSection(suite.perf)}
  <footer>Generato da ${esc(brand)} 🔦 — GEO, accessibilità e performance. I punteggi non vanno sommati: misurano dimensioni diverse.</footer>
</body></html>`;
}

export function toMarkdownSuite(suite, { date = '', brand = 'Beacon' } = {}) {
  const L = [`# Report completo — ${suite.host}`, '', `${suite.url}${date ? ' · ' + date : ''}`, ''];
  // GEO
  if (suite.geo && !suite.geo.error) {
    const d = normalize(suite.geo);
    L.push(`## GEO / AI-readiness — ${d.overall}/100 (${verdict(d.overall)})`, '');
    for (const [k, label] of Object.entries(CATEGORY_LABELS)) L.push(`- ${label}: ${d.scores[k]}/100`);
  } else L.push('## GEO / AI-readiness', `Non disponibile: ${suite.geo && suite.geo.error}`);
  L.push('');
  // a11y
  if (suite.a11y && !suite.a11y.error) {
    const st = suite.a11y.result, axe = suite.a11y.axe;
    L.push(`## Accessibilità — ${st ? st.score : '?'}/100 (controlli statici)`, '');
    (st && st.checks ? st.checks : []).filter((c) => c.status !== 'good' && c.status !== 'info')
      .forEach((c) => L.push(`- ${c.name} — ${c.detail}${c.fix ? ` → ${c.fix}` : ''}`));
    if (axe && axe.ok) {
      L.push('', `### axe-core — ${axe.counts.violations} violazioni`, '');
      axe.findings.forEach((f) => { L.push(`- **${f.help}** (${f.impact}, ${f.nodes} el)`); if (f.remedy && f.remedy.after) L.push(`  - dopo: \`${f.remedy.after.replace(/\n/g, ' ')}\``); });
    }
    L.push('', '> Il test automatico copre ~metà dei criteri WCAG: la conformità richiede verifica umana.');
  } else L.push('## Accessibilità', `Non disponibile: ${suite.a11y && suite.a11y.error}`);
  L.push('');
  // perf
  if (suite.perf && suite.perf.ok) {
    const r = suite.perf.result;
    L.push(`## Performance — ${r.score}/100 (Lighthouse)`, '');
    r.metrics.forEach((m) => L.push(`- ${m.name}: ${m.detail}`));
    if (r.opportunities.length) { L.push('', '### Dove guadagnare velocità', ''); r.opportunities.forEach((o) => L.push(`- ${o.title} (~${(o.savingsMs / 1000).toFixed(1)}s)`)); }
  } else L.push('## Performance', `Non disponibile: ${(suite.perf && (suite.perf.reason || suite.perf.error)) || 'errore'}`);
  L.push('', `---`, `*Generato da ${brand} 🔦 — i punteggi misurano dimensioni diverse, non si sommano.*`);
  return L.join('\n');
}

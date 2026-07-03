// src/report.js — export cliente-ready: Markdown + HTML brandizzato.
// Funzioni pure: prendono un risultato di audit() o crawlSite() e ritornano una stringa.
import { CATEGORY_LABELS } from './analyzers.js';

export const verdict = (s) => (s >= 80 ? 'Buono' : s >= 60 ? 'Discreto' : s >= 40 ? 'Da migliorare' : 'Critico');

// Normalizza audit() e crawlSite() in una forma comune.
export function normalize(r) {
  if (r.aggregate) {
    // risultato di crawlSite: categorie già numeriche, fix dalla home
    const fixes = collectFixes(r.home);
    return { host: r.host, url: r.url, kind: 'sito', pages: r.pagesAnalyzed, overall: r.aggregate.overall, scores: r.aggregate.categories, fixes };
  }
  const scores = Object.fromEntries(Object.keys(CATEGORY_LABELS).map((k) => [k, r.categories[k].score]));
  return { host: r.host, url: r.url, kind: 'pagina', pages: 1, overall: r.overall, scores, fixes: collectFixes(r) };
}
function collectFixes(auditLike) {
  const out = [];
  if (!auditLike?.categories) return out;
  for (const k of Object.keys(CATEGORY_LABELS)) {
    for (const c of auditLike.categories[k]?.checks || []) if (c.fix) out.push({ cat: CATEGORY_LABELS[k], fix: c.fix });
  }
  return out;
}

export function toMarkdown(r, { date = '' } = {}) {
  const d = normalize(r);
  let md = `# Report AI-readiness — ${d.host}\n\n`;
  md += `**Punteggio ${d.kind}: ${d.overall}/100** (${verdict(d.overall)})\n\n`;
  md += `- URL: ${d.url}\n- Pagine analizzate: ${d.pages}\n${date ? `- Data: ${date}\n` : ''}\n`;
  md += `## Categorie\n\n| Categoria | Punteggio | Esito |\n|---|--:|---|\n`;
  for (const [k, label] of Object.entries(CATEGORY_LABELS)) md += `| ${label} | ${d.scores[k]}/100 | ${verdict(d.scores[k])} |\n`;
  if (d.fixes.length) {
    md += `\n## Azioni consigliate\n\n`;
    for (const f of d.fixes.slice(0, 10)) md += `- **${f.cat}** — ${f.fix}\n`;
  }
  md += `\n---\n*Report generato da Beacon 🔦 — GEO / AI-readiness checker.*\n`;
  return md;
}

export function toHtml(r, { date = '' } = {}) {
  const d = normalize(r);
  const color = (s) => (s >= 80 ? '#2E8B5F' : s >= 60 ? '#B4841F' : s >= 40 ? '#C77D2E' : '#C0492F');
  const rows = Object.entries(CATEGORY_LABELS).map(([k, label]) => {
    const s = d.scores[k];
    return `<tr><td>${label}</td><td class="n" style="color:${color(s)}">${s}</td>
      <td><div class="bar"><i style="width:${s}%;background:${color(s)}"></i></div></td></tr>`;
  }).join('');
  const fixes = d.fixes.length
    ? `<h2>Azioni consigliate</h2><ul>${d.fixes.slice(0, 10).map((f) => `<li><b>${f.cat}</b> — ${f.fix}</li>`).join('')}</ul>`
    : '';
  return `<!doctype html><html lang="it"><head><meta charset="utf-8">
<title>Beacon · ${d.host}</title>
<style>
  @page{margin:18mm}
  body{font:15px/1.6 system-ui,-apple-system,Segoe UI,sans-serif;color:#16221F;max-width:720px;margin:32px auto;padding:0 20px}
  .eyebrow{font:600 12px/1 ui-monospace,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:#0E6E6B}
  h1{font:700 26px/1.2 Georgia,serif;margin:.2em 0}
  .score{font:700 54px/1 Georgia,serif;color:#0E6E6B}
  .score small{font:600 16px/1 ui-monospace,monospace;color:#8A9896}
  .meta{color:#5C6B69;font-size:13px;margin:.5em 0 1.5em}
  table{border-collapse:collapse;width:100%;margin:12px 0}
  td{padding:9px 8px;border-bottom:1px solid #E2E8E8;vertical-align:middle}
  td.n{font:700 15px ui-monospace,monospace;text-align:right;width:48px}
  .bar{height:7px;border-radius:4px;background:#EEF3F2;overflow:hidden}
  .bar i{display:block;height:100%;border-radius:4px}
  h2{font:600 17px Georgia,serif;margin-top:1.8em}
  ul{padding-left:1.1em} li{margin:.35em 0}
  footer{margin-top:2em;color:#8A9896;font-size:12px;border-top:1px solid #E2E8E8;padding-top:10px}
</style></head><body>
  <div class="eyebrow">Report AI-readiness</div>
  <h1>${d.host}</h1>
  <div class="score">${d.overall}<small>/100 · ${verdict(d.overall)}</small></div>
  <div class="meta">${d.url} · ${d.pages} pagina/e${date ? ' · ' + date : ''}</div>
  <table>${rows}</table>
  ${fixes}
  <footer>Generato da Beacon 🔦 — GEO / AI-readiness checker.</footer>
</body></html>`;
}

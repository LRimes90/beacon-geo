// src/a11y.js — modulo ACCESSIBILITÀ (companion, SEPARATO dallo score GEO).
// Prodotto diverso, stesso motore: analizza l'HTML servito con analyzer propri.
// Copre SOLO i criteri WCAG 2.1 verificabili staticamente dall'HTML servito.
// NON è un audit di conformità: ~60% dei criteri (tastiera, focus order, senso
// per screen reader) e il contrasto reale richiedono testing umano / rendering.
// EAA (Dir. UE 2019/882) → EN 301 549 → WCAG 2.1 AA: qui i check "a colpo sicuro".
import { fetchText, getTitle, getMeta, imgAlt, headings } from './lib.js';
import { remedyFor } from './remediation.js';

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const pct = (a, b) => (b ? (a / b) * 100 : 0);

// Conta i controlli di form e quanti hanno un'etichetta accessibile.
// Vedi la richiesta "Learn by Doing": decisione di prodotto su cosa conta come label.
export function accessibleFormLabels(html) {
  // TODO(human)
  return { total: 0, labeled: 0 };
}

// gerarchia titoli: quanti H1 e se qualche livello è saltato (es. H3 senza H2).
function headingIssues(h) {
  const present = [1, 2, 3, 4, 5, 6].filter((i) => h['h' + i] > 0);
  let skipped = false;
  for (let i = 1; i < present.length; i++) if (present[i] - present[i - 1] > 1) skipped = true;
  return { h1: h.h1, skipped, hasAny: present.length > 0 };
}

// Analizzatore PURO: riceve l'HTML, ritorna { score, checks } come gli altri.
export function analyzeA11y(html) {
  const lang = /<html\b[^>]*\blang\s*=\s*["'][a-z]/i.test(html);
  const title = getTitle(html) || '';
  const alt = imgAlt(html);
  const h = headingIssues(headings(html));
  const form = accessibleFormLabels(html);
  const vp = getMeta(html, 'viewport') || '';
  const zoomBlocked = /user-scalable\s*=\s*(no|0)/i.test(vp) || /maximum-scale\s*=\s*(0|1(\.0+)?)\b/i.test(vp);

  const checks = [
    { name: 'Lingua della pagina (lang)', status: lang ? 'good' : 'crit',
      detail: lang ? 'attributo lang presente su <html>' : 'manca lang su <html>',
      fix: lang ? null : 'Dichiara la lingua: <html lang="it"> — WCAG 3.1.1' },
    { name: 'Titolo di pagina', status: title ? 'good' : 'crit',
      detail: title ? `"${title.slice(0, 60)}"` : 'nessun <title>',
      fix: title ? null : 'Dai a ogni pagina un <title> univoco e descrittivo — WCAG 2.4.2' },
    { name: 'Testo alternativo immagini', status: !alt.total || alt.withAlt === alt.total ? 'good' : 'crit',
      detail: `${alt.withAlt}/${alt.total} immagini con alt`,
      fix: alt.total && alt.withAlt < alt.total ? 'Aggiungi alt a tutte le <img> (alt="" se decorative) — WCAG 1.1.1' : null },
    { name: 'Struttura dei titoli', status: h.h1 === 1 && !h.skipped ? 'good' : h.hasAny ? 'warn' : 'crit',
      detail: `H1: ${h.h1}${h.skipped ? ' — livelli saltati' : ''}`,
      fix: h.h1 !== 1 || h.skipped ? 'Un solo H1 e nessun livello saltato (no H3 senza H2) — WCAG 1.3.1' : null },
    { name: 'Etichette dei campi form', status: !form.total ? 'good' : form.labeled === form.total ? 'good' : 'crit',
      detail: !form.total ? 'nessun campo form rilevato' : `${form.labeled}/${form.total} campi con etichetta accessibile`,
      fix: form.total && form.labeled < form.total ? 'Associa una <label> (o aria-label) a ogni campo — WCAG 1.3.1 / 4.1.2' : null },
    { name: 'Zoom non disabilitato', status: zoomBlocked ? 'crit' : 'good',
      detail: zoomBlocked ? 'il viewport blocca lo zoom (user-scalable=no / maximum-scale=1)' : 'zoom consentito',
      fix: zoomBlocked ? 'Togli user-scalable=no e maximum-scale dal meta viewport — WCAG 1.4.4' : null },
    // ponytail: contrasto reale = getComputedStyle in un browser (render.js/Playwright).
    // Dall'HTML servito non è affidabile → lo dichiariamo, non lo fingiamo.
    { name: 'Contrasto colore', status: 'info',
      detail: 'richiede rendering + verifica manuale (non deducibile dall\'HTML servito)',
      fix: 'Verifica contrasto testo/sfondo ≥ 4.5:1 (3:1 per testo grande) — WCAG 1.4.3' },
  ];

  const scored = checks.filter((c) => c.status !== 'info');
  const good = scored.filter((c) => c.status === 'good').length;
  return { informational: true, module: 'a11y', score: clamp(pct(good, scored.length)), checks };
}
export const A11Y_LABEL = 'Accessibilità di base';

// Mappa i risultati grezzi di axe-core in un riassunto compatto per la UI (funzione pura).
const IMPACT_STATUS = { critical: 'crit', serious: 'crit', moderate: 'warn', minor: 'info' };
const STATUS_ORDER = { crit: 0, warn: 1, info: 2 };
export function summarizeAxe(results) {
  const violations = results.violations || [];
  const findings = violations.map((x) => {
    const node = (x.nodes && x.nodes[0]) || {};
    const f = {
      id: x.id,
      status: IMPACT_STATUS[x.impact] || 'warn',
      impact: x.impact || 'n/d',
      help: x.help,
      helpUrl: x.helpUrl,
      nodes: (x.nodes || []).length,
      sample: node.target ? node.target.join(' ') : '',
      sampleHtml: node.html || '',
      failureSummary: node.failureSummary || '',
    };
    f.remedy = remedyFor(f); // esempio "prima → dopo" senza AI, con fallback su axe
    return f;
  }).sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  return {
    counts: {
      violations: violations.length,
      passes: (results.passes || []).length,
      incomplete: (results.incomplete || []).length,
    },
    findings,
  };
}

// Orchestratore sottile (I/O): scarica l'HTML servito e lancia l'analyzer statico.
// Con { deep:true } esegue anche axe-core nel DOM renderizzato (contrasto reale + ARIA).
export async function auditA11y(rawUrl, { deep = false } = {}) {
  let u = String(rawUrl).trim();
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  const url = new URL(u).href;
  const page = await fetchText(url);
  const html = page.body || '';
  const result = html ? analyzeA11y(html) : null;
  let axe = null;
  if (deep) {
    const { runAxe } = await import('./render.js');
    const r = await runAxe(url);
    axe = r.ok ? { ok: true, ...summarizeAxe(r.results) } : { ok: false, reason: r.reason };
  }
  return { url, host: new URL(url).host, fetchedOk: page.ok, result, axe };
}

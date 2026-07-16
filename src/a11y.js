// src/a11y.js — modulo ACCESSIBILITÀ (companion, SEPARATO dallo score GEO).
// Prodotto diverso, stesso motore: analizza l'HTML servito con analyzer propri.
// Copre SOLO i criteri WCAG 2.1 verificabili staticamente dall'HTML servito.
// NON è un audit di conformità: ~60% dei criteri (tastiera, focus order, senso
// per screen reader) e il contrasto reale richiedono testing umano / rendering.
// EAA (Dir. UE 2019/882) → EN 301 549 → WCAG 2.1 AA: qui i check "a colpo sicuro".
// i18n: analyzeA11y/summarizeAxe/auditA11y accettano `lang` (default 'it');
// le stringhe vengono dal catalogo src/messages/ (fallback italiano).
import { fetchText, getTitle, getMeta, imgAlt, headings } from './lib.js';
import { remedyFor } from './remediation.js';
import { makeT } from './messages/index.js';

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
export function analyzeA11y(html, lang = 'it') {
  const t = makeT(lang);
  const hasLang = /<html\b[^>]*\blang\s*=\s*["'][a-z]/i.test(html);
  const title = getTitle(html) || '';
  const alt = imgAlt(html);
  const h = headingIssues(headings(html));
  const form = accessibleFormLabels(html);
  const vp = getMeta(html, 'viewport') || '';
  const zoomBlocked = /user-scalable\s*=\s*(no|0)/i.test(vp) || /maximum-scale\s*=\s*(0|1(\.0+)?)\b/i.test(vp);

  const checks = [
    { name: t('a11y.lang.name'), status: hasLang ? 'good' : 'crit',
      detail: hasLang ? t('a11y.lang.detail.ok') : t('a11y.lang.detail.no'),
      fix: hasLang ? null : t('a11y.lang.fix') },
    { name: t('a11y.title.name'), status: title ? 'good' : 'crit',
      detail: title ? `"${title.slice(0, 60)}"` : t('a11y.title.detail.no'),
      fix: title ? null : t('a11y.title.fix') },
    { name: t('a11y.alt.name'), status: !alt.total || alt.withAlt === alt.total ? 'good' : 'crit',
      detail: t('a11y.alt.detail', { withAlt: alt.withAlt, total: alt.total }),
      fix: alt.total && alt.withAlt < alt.total ? t('a11y.alt.fix') : null },
    { name: t('a11y.headings.name'), status: h.h1 === 1 && !h.skipped ? 'good' : h.hasAny ? 'warn' : 'crit',
      detail: t('a11y.headings.detail', { h1: h.h1 }) + (h.skipped ? t('a11y.headings.skipped') : ''),
      fix: h.h1 !== 1 || h.skipped ? t('a11y.headings.fix') : null },
    { name: t('a11y.labels.name'), status: !form.total ? 'good' : form.labeled === form.total ? 'good' : 'crit',
      detail: !form.total ? t('a11y.labels.detail.none') : t('a11y.labels.detail', { labeled: form.labeled, total: form.total }),
      fix: form.total && form.labeled < form.total ? t('a11y.labels.fix') : null },
    { name: t('a11y.zoom.name'), status: zoomBlocked ? 'crit' : 'good',
      detail: zoomBlocked ? t('a11y.zoom.detail.blocked') : t('a11y.zoom.detail.ok'),
      fix: zoomBlocked ? t('a11y.zoom.fix') : null },
    // ponytail: contrasto reale = getComputedStyle in un browser (render.js/Playwright).
    // Dall'HTML servito non è affidabile → lo dichiariamo, non lo fingiamo.
    { name: t('a11y.contrast.name'), status: 'info',
      detail: t('a11y.contrast.detail'),
      fix: t('a11y.contrast.fix') },
  ];

  const scored = checks.filter((c) => c.status !== 'info');
  const good = scored.filter((c) => c.status === 'good').length;
  return { informational: true, module: 'a11y', score: clamp(pct(good, scored.length)), checks };
}
export const A11Y_LABEL = 'Accessibilità di base';

// Mappa i risultati grezzi di axe-core in un riassunto compatto per la UI (funzione pura).
// NB: help/failureSummary restano nella lingua di axe-core (inglese) — vedi README i18n.
const IMPACT_STATUS = { critical: 'crit', serious: 'crit', moderate: 'warn', minor: 'info' };
const STATUS_ORDER = { crit: 0, warn: 1, info: 2 };
export function summarizeAxe(results, lang = 'it') {
  const t = makeT(lang);
  const violations = results.violations || [];
  const findings = violations.map((x) => {
    const node = (x.nodes && x.nodes[0]) || {};
    const f = {
      id: x.id,
      status: IMPACT_STATUS[x.impact] || 'warn',
      impact: x.impact || t('axe.nd'),
      help: x.help,
      helpUrl: x.helpUrl,
      nodes: (x.nodes || []).length,
      sample: node.target ? node.target.join(' ') : '',
      sampleHtml: node.html || '',
      failureSummary: node.failureSummary || '',
    };
    f.remedy = remedyFor(f, lang); // esempio "prima → dopo" senza AI, con fallback su axe
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
export async function auditA11y(rawUrl, { deep = false, lang = 'it' } = {}) {
  let u = String(rawUrl).trim();
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  const url = new URL(u).href;
  const page = await fetchText(url);
  const html = page.body || '';
  const result = html ? analyzeA11y(html, lang) : null;
  let axe = null;
  if (deep) {
    const { runAxe } = await import('./render.js');
    const r = await runAxe(url);
    axe = r.ok ? { ok: true, ...summarizeAxe(r.results, lang) } : { ok: false, reason: r.reason };
  }
  return { url, host: new URL(url).host, fetchedOk: page.ok, result, axe };
}

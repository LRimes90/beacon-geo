// src/analyzers.js — i 5+1 analizzatori come FUNZIONI PURE.
// Ognuna riceve dati già raccolti (niente rete qui: così sono testabili con assert)
// e ritorna { score: 0-100, checks: [{name, status, detail, fix?}] }.
// status: 'good' | 'warn' | 'crit' | 'info'
// i18n: ogni analyzer accetta `lang` (default 'it') e legge le stringhe dal
// catalogo src/messages/ — la logica di punteggio resta identica.
import { getTitle, getMeta, jsonLdTypes, jsonLdCount, semanticRatio, headings, imgAlt, wordCount, links } from './lib.js';
import { makeT } from './messages/index.js';

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const pct = (a, b) => (b ? (a / b) * 100 : 0);

// ① ACCESSO AI — quota di crawler ammessi dal robots.txt + che raggiungono la pagina live.
export function analyzeAccess({ robotsAllowed, liveFetch }, lang = 'it') {
  const t = makeT(lang);
  const total = Object.keys(robotsAllowed).length || 1;
  const allowed = Object.values(robotsAllowed).filter(Boolean).length;
  const liveTotal = Object.keys(liveFetch).length || 1;
  const liveOk = Object.values(liveFetch).filter((r) => r.ok).length;
  const score = clamp(0.6 * pct(allowed, total) + 0.4 * pct(liveOk, liveTotal));
  const st = (p) => (p >= 0.9 ? 'good' : p >= 0.5 ? 'warn' : 'crit');
  return {
    score,
    checks: [
      { name: t('access.robots.name'), status: st(allowed / total),
        detail: t('access.robots.detail', { allowed, total }),
        fix: allowed < total ? t('access.robots.fix') : null },
      { name: t('access.live.name'), status: st(liveOk / liveTotal),
        detail: t('access.live.detail', { ok: liveOk, total: liveTotal }),
        fix: liveOk < liveTotal ? t('access.live.fix') : null },
    ],
  };
}

// ② FILE PER AGENTI E AI — file base + standard emergenti.
export function analyzeAgentFiles(files, lang = 'it') {
  const t = makeT(lang);
  // files: { robotsTxt, sitemap, llmsTxt, skillMd, mcpJson, agentSkills } (bool)
  const base = ['robotsTxt', 'sitemap', 'llmsTxt'];
  const emerging = ['skillMd', 'mcpJson', 'agentSkills'];
  const baseHave = base.filter((k) => files[k]).length;
  const emHave = emerging.filter((k) => files[k]).length;
  // Base pesa 70, emergenti 30 (bonus: sei in anticipo sulla concorrenza).
  const score = clamp(0.7 * pct(baseHave, base.length) + 0.3 * pct(emHave, emerging.length));
  return {
    score,
    checks: [
      { name: t('agentFiles.base.name'), status: baseHave === 3 ? 'good' : baseHave >= 2 ? 'warn' : 'crit',
        detail: t('agentFiles.base.detail', { have: baseHave }) + (!files.llmsTxt ? t('agentFiles.base.missingLlms') : ''),
        fix: !files.llmsTxt ? t('agentFiles.base.fix') : null },
      { name: t('agentFiles.emerging.name'), status: emHave ? 'good' : 'info',
        detail: t('agentFiles.emerging.detail', { have: emHave }),
        fix: emHave === 0 ? t('agentFiles.emerging.fix') : null },
    ],
  };
}

// ③ DATI STRUTTURATI E SEO
export function analyzeStructured(html, lang = 'it') {
  const t = makeT(lang);
  const title = getTitle(html) || '';
  const desc = getMeta(html, 'description') || '';
  const types = jsonLdTypes(html);
  const okTitle = title.length >= 15 && title.length <= 65;
  const okDesc = desc.length >= 50 && desc.length <= 160;
  const signals = {
    canonical: /<link[^>]+rel=["\']canonical["\']/i.test(html),
    hreflang: /<link[^>]+hreflang=/i.test(html),
    og: /<meta[^>]+property=["\']og:/i.test(html),
    twitter: /<meta[^>]+name=["\']twitter:/i.test(html),
  };
  const sigHave = Object.values(signals).filter(Boolean).length;
  const score = clamp((okTitle ? 20 : title ? 10 : 0) + (okDesc ? 20 : desc ? 10 : 0) + (types.length ? 30 : 0) + pct(sigHave, 4) * 0.3);
  return {
    score,
    checks: [
      { name: t('structured.meta.name'), status: okTitle && okDesc ? 'good' : 'warn',
        detail: t('structured.meta.detail', { title: title.length, desc: desc.length }),
        fix: !okTitle || !okDesc ? t('structured.meta.fix') : null },
      { name: t('structured.jsonld.name'), status: types.length ? 'good' : 'crit',
        detail: types.length ? t('structured.jsonld.detail', { count: jsonLdCount(html), types: types.join(', ') }) : t('structured.jsonld.none'),
        fix: !types.length ? t('structured.jsonld.fix') : null },
      { name: t('structured.signals.name'), status: sigHave >= 3 ? 'good' : sigHave >= 1 ? 'warn' : 'crit',
        detail: t('structured.signals.detail', { have: sigHave }),
        fix: sigHave < 3 ? t('structured.signals.fix') : null },
    ],
  };
}

// ④ LEGGIBILITÀ PER LE MACCHINE — calcolata su HTML servito; se disponibile, confronta col post-render.
export function analyzeReadability({ served, rendered }, lang = 'it') {
  const t = makeT(lang);
  const s = readabilityMetrics(served);
  // Ogni termine è già in scala (max 30/30/20/20 = 100). pct() ritorna 0-100 → moltiplica per 0.x per riportare in scala.
  const score = clamp(
    (s.words >= 300 ? 30 : pct(s.words, 300) * 0.3) +
    (s.ratio >= 0.05 ? 30 : pct(s.ratio, 0.05) * 0.3) +
    (s.h1 === 1 ? 20 : s.h1 > 1 ? 10 : 0) +
    (s.imgTotal ? pct(s.imgAlt, s.imgTotal) * 0.2 : 20)
  );
  const checks = [
    { name: t('readability.words.name'), status: s.words >= 300 ? 'good' : s.words >= 100 ? 'warn' : 'crit',
      detail: t('readability.words.detail', { words: s.words }),
      fix: s.words < 300 ? t('readability.words.fix') : null },
    { name: t('readability.semantic.name'), status: s.ratio >= 0.05 ? 'good' : s.ratio >= 0.02 ? 'warn' : 'crit',
      detail: t('readability.semantic.detail', { pct: (s.ratio * 100).toFixed(1), semantic: s.semantic, total: s.total }),
      fix: s.ratio < 0.05 ? t('readability.semantic.fix') : null },
    { name: t('readability.headings.name'), status: s.h1 === 1 ? 'good' : 'warn',
      detail: t('readability.headings.detail', { h1: s.h1, total: s.hTotal }),
      fix: s.h1 !== 1 ? t('readability.headings.fix') : null },
    { name: t('readability.alt.name'), status: !s.imgTotal || s.imgAlt === s.imgTotal ? 'good' : 'warn',
      detail: t('readability.alt.detail', { withAlt: s.imgAlt, total: s.imgTotal }),
      fix: s.imgTotal && s.imgAlt < s.imgTotal ? t('readability.alt.fix') : null },
  ];
  // 🆕 differenziatore: delta no-JS vs post-render
  if (rendered) {
    const r = readabilityMetrics(rendered);
    const gain = r.words - s.words;
    checks.push({
      name: t('readability.jsdelta.name'),
      status: gain > s.words * 0.5 ? 'crit' : gain > 50 ? 'warn' : 'good',
      detail: t('readability.jsdelta.detail', { gain, served: s.words, rendered: r.words }),
      fix: gain > 50 ? t('readability.jsdelta.fix') : null,
    });
  }
  return { score, checks };
}
function readabilityMetrics(html) {
  const sr = semanticRatio(html);
  const h = headings(html);
  const alt = imgAlt(html);
  return {
    words: wordCount(html), semantic: sr.semantic, total: sr.total, ratio: sr.ratio,
    h1: h.h1, hTotal: Object.values(h).reduce((a, b) => a + b, 0),
    imgTotal: alt.total, imgAlt: alt.withAlt,
  };
}

// ⑤ VISIBILITÀ OFF-SITE — CCBot ammesso + presenza in Common Crawl (best-effort).
export function analyzeOffsite({ ccbotAllowed, inCommonCrawl }, lang = 'it') {
  const t = makeT(lang);
  let score = ccbotAllowed ? 60 : 0;
  if (inCommonCrawl === true) score = 100;
  else if (inCommonCrawl === null && ccbotAllowed) score = 60; // CC non interrogabile: non penalizziamo oltre
  return {
    score: clamp(score),
    checks: [
      { name: t('offsite.ccbot.name'), status: ccbotAllowed ? 'good' : 'crit',
        detail: ccbotAllowed ? t('offsite.ccbot.detail.ok') : t('offsite.ccbot.detail.blocked'),
        fix: !ccbotAllowed ? t('offsite.ccbot.fix') : null },
      { name: t('offsite.cc.name'), status: inCommonCrawl === true ? 'good' : 'info',
        detail: inCommonCrawl === true ? t('offsite.cc.detail.found') : inCommonCrawl === false ? t('offsite.cc.detail.notFound') : t('offsite.cc.detail.unavailable') },
    ],
  };
}

// Etichette categorie localizzate (per report/CLI); CATEGORY_LABELS resta la
// costante italiana storica, ora derivata dal catalogo (retro-compatibile).
export function categoryLabels(lang = 'it') {
  const t = makeT(lang);
  return {
    access: t('category.access'), agentFiles: t('category.agentFiles'), structured: t('category.structured'),
    readability: t('category.readability'), offsite: t('category.offsite'),
  };
}
export const CATEGORY_LABELS = categoryLabels('it');

// ⑥ SEGNALI E DIRITTI AI — informativo (NON pesato): cosa il sito dichiara alle AI su uso/licenze.
// TDMRep (.well-known/tdmrep.json), RSL / rel="license", Content-Signal (robots/header).
export function analyzeRights({ tdmrep, license, contentSignal }, lang = 'it') {
  const t = makeT(lang);
  const present = [tdmrep, license, contentSignal].filter(Boolean).length;
  return {
    informational: true,
    score: clamp(pct(present, 3)),
    checks: [
      { name: t('rights.tdmrep.name'), status: tdmrep ? 'good' : 'info',
        detail: tdmrep ? t('rights.tdmrep.detail.ok') : t('rights.tdmrep.detail.none'),
        fix: tdmrep ? null : t('rights.tdmrep.fix') },
      { name: t('rights.license.name'), status: license ? 'good' : 'info',
        detail: license ? t('rights.license.detail.ok') : t('rights.license.detail.none') },
      { name: t('rights.signal.name'), status: contentSignal ? 'good' : 'info',
        detail: contentSignal ? t('rights.signal.detail.ok') : t('rights.signal.detail.none'),
        fix: contentSignal ? null : t('rights.signal.fix') },
    ],
  };
}
export const RIGHTS_LABEL = 'Segnali e diritti AI';

// ⑦ FONDAMENTALI TECNICI — informativo ma con allarmi forti (noindex/HTTPS bloccano la visibilità).
export function analyzeTech({ https, noindex, viewport, statusOk }, lang = 'it') {
  const t = makeT(lang);
  const checks = [
    { name: t('tech.https.name'), status: https ? 'good' : 'crit',
      detail: https ? t('tech.https.detail.ok') : t('tech.https.detail.no'),
      fix: https ? null : t('tech.https.fix') },
    { name: t('tech.noindex.name'), status: noindex ? 'crit' : 'good',
      detail: noindex ? t('tech.noindex.detail.no') : t('tech.noindex.detail.ok'),
      fix: noindex ? t('tech.noindex.fix') : null },
    { name: t('tech.viewport.name'), status: viewport ? 'good' : 'warn',
      detail: viewport ? t('tech.viewport.detail.ok') : t('tech.viewport.detail.no'),
      fix: viewport ? null : t('tech.viewport.fix') },
    { name: t('tech.status.name'), status: statusOk ? 'good' : 'crit',
      detail: statusOk ? t('tech.status.detail.ok') : t('tech.status.detail.no') },
  ];
  const good = checks.filter((c) => c.status === 'good').length;
  return { informational: true, score: clamp(pct(good, 4)), checks };
}
export const TECH_LABEL = 'Fondamentali tecnici';

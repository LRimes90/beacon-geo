// src/analyzers.js — i 5+1 analizzatori come FUNZIONI PURE.
// Ognuna riceve dati già raccolti (niente rete qui: così sono testabili con assert)
// e ritorna { score: 0-100, checks: [{name, status, detail, fix?}] }.
// status: 'good' | 'warn' | 'crit' | 'info'
import { getTitle, getMeta, jsonLdTypes, jsonLdCount, semanticRatio, headings, imgAlt, wordCount, links } from './lib.js';

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const pct = (a, b) => (b ? (a / b) * 100 : 0);

// ① ACCESSO AI — quota di crawler ammessi dal robots.txt + che raggiungono la pagina live.
export function analyzeAccess({ robotsAllowed, liveFetch }) {
  const total = Object.keys(robotsAllowed).length || 1;
  const allowed = Object.values(robotsAllowed).filter(Boolean).length;
  const liveTotal = Object.keys(liveFetch).length || 1;
  const liveOk = Object.values(liveFetch).filter((r) => r.ok).length;
  const score = clamp(0.6 * pct(allowed, total) + 0.4 * pct(liveOk, liveTotal));
  const st = (p) => (p >= 0.9 ? 'good' : p >= 0.5 ? 'warn' : 'crit');
  return {
    score,
    checks: [
      { name: 'Crawler AI ammessi (robots.txt)', status: st(allowed / total),
        detail: `${allowed}/${total} crawler AI ammessi`,
        fix: allowed < total ? 'Rimuovi i Disallow che bloccano GPTBot/ClaudeBot/PerplexityBot ecc. dal robots.txt' : null },
      { name: 'Raggiungibilità live (fetch impersonato)', status: st(liveOk / liveTotal),
        detail: `${liveOk}/${liveTotal} user-agent hanno ricevuto la pagina`,
        fix: liveOk < liveTotal ? 'Rimuovi blocchi lato server/WAF/Cloudflare sugli user-agent AI' : null },
    ],
  };
}

// ② FILE PER AGENTI E AI — file base + standard emergenti.
export function analyzeAgentFiles(files) {
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
      { name: 'File di base (robots, sitemap, llms.txt)', status: baseHave === 3 ? 'good' : baseHave >= 2 ? 'warn' : 'crit',
        detail: `${baseHave}/3 presenti` + (!files.llmsTxt ? ' — manca llms.txt' : ''),
        fix: !files.llmsTxt ? 'Genera e pubblica /llms.txt (usa: beacon <url> --llms)' : null },
      { name: 'Standard agentici emergenti', status: emHave ? 'good' : 'info',
        detail: `${emHave}/3 (skill.md, .well-known/mcp.json, agent-skills)`,
        fix: emHave === 0 ? 'Opportunità: aggiungi skill.md e .well-known/mcp.json per essere leggibile dagli agenti' : null },
    ],
  };
}

// ③ DATI STRUTTURATI E SEO
export function analyzeStructured(html) {
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
      { name: 'Title & meta description', status: okTitle && okDesc ? 'good' : 'warn',
        detail: `title ${title.length} char, description ${desc.length} char`,
        fix: !okTitle || !okDesc ? 'Title 15-65 char, meta description 50-160 char, unici per pagina' : null },
      { name: 'Dati strutturati (JSON-LD)', status: types.length ? 'good' : 'crit',
        detail: types.length ? `${jsonLdCount(html)} blocchi: ${types.join(', ')}` : 'nessun JSON-LD',
        fix: !types.length ? 'Aggiungi JSON-LD Schema.org (almeno Organization + WebSite)' : null },
      { name: 'Meta di indicizzazione/condivisione', status: sigHave >= 3 ? 'good' : sigHave >= 1 ? 'warn' : 'crit',
        detail: `${sigHave}/4 (canonical, hreflang, OG, Twitter)`,
        fix: sigHave < 3 ? 'Aggiungi canonical + Open Graph + Twitter Card' : null },
    ],
  };
}

// ④ LEGGIBILITÀ PER LE MACCHINE — calcolata su HTML servito; se disponibile, confronta col post-render.
export function analyzeReadability({ served, rendered }) {
  const s = readabilityMetrics(served);
  // Ogni termine è già in scala (max 30/30/20/20 = 100). pct() ritorna 0-100 → moltiplica per 0.x per riportare in scala.
  const score = clamp(
    (s.words >= 300 ? 30 : pct(s.words, 300) * 0.3) +
    (s.ratio >= 0.05 ? 30 : pct(s.ratio, 0.05) * 0.3) +
    (s.h1 === 1 ? 20 : s.h1 > 1 ? 10 : 0) +
    (s.imgTotal ? pct(s.imgAlt, s.imgTotal) * 0.2 : 20)
  );
  const checks = [
    { name: 'Contenuto nell\'HTML servito', status: s.words >= 300 ? 'good' : s.words >= 100 ? 'warn' : 'crit',
      detail: `${s.words} parole leggibili senza JS`,
      fix: s.words < 300 ? 'Rendi il contenuto disponibile server-side (SSR/SSG), non solo via JavaScript' : null },
    { name: 'Ratio semantico HTML5', status: s.ratio >= 0.05 ? 'good' : s.ratio >= 0.02 ? 'warn' : 'crit',
      detail: `${(s.ratio * 100).toFixed(1)}% (${s.semantic} tag semantici su ${s.total})`,
      fix: s.ratio < 0.05 ? 'Usa header/nav/main/article/section/footer invece di soli <div>' : null },
    { name: 'Struttura heading', status: s.h1 === 1 ? 'good' : 'warn',
      detail: `H1: ${s.h1}, heading totali: ${s.hTotal}`,
      fix: s.h1 !== 1 ? 'Usa un solo H1 e una gerarchia chiara H2/H3' : null },
    { name: 'Alt delle immagini', status: !s.imgTotal || s.imgAlt === s.imgTotal ? 'good' : 'warn',
      detail: `${s.imgAlt}/${s.imgTotal} immagini con alt`,
      fix: s.imgTotal && s.imgAlt < s.imgTotal ? 'Aggiungi attributo alt descrittivo a tutte le immagini' : null },
  ];
  // 🆕 differenziatore: delta no-JS vs post-render
  if (rendered) {
    const r = readabilityMetrics(rendered);
    const gain = r.words - s.words;
    checks.push({
      name: 'Delta JavaScript (no-JS vs render)',
      status: gain > s.words * 0.5 ? 'crit' : gain > 50 ? 'warn' : 'good',
      detail: `+${gain} parole dopo il render (servito ${s.words} → render ${r.words})`,
      fix: gain > 50 ? 'Molto contenuto è iniettato via JS: i bot che non eseguono JS non lo vedono. Valuta SSR.' : null,
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
export function analyzeOffsite({ ccbotAllowed, inCommonCrawl }) {
  let score = ccbotAllowed ? 60 : 0;
  if (inCommonCrawl === true) score = 100;
  else if (inCommonCrawl === null && ccbotAllowed) score = 60; // CC non interrogabile: non penalizziamo oltre
  return {
    score: clamp(score),
    checks: [
      { name: 'Accesso a CCBot (Common Crawl)', status: ccbotAllowed ? 'good' : 'crit',
        detail: ccbotAllowed ? 'CCBot ammesso dal robots.txt' : 'CCBot bloccato',
        fix: !ccbotAllowed ? 'Ammetti CCBot: molte AI hanno imparato da Common Crawl' : null },
      { name: 'Presenza in Common Crawl', status: inCommonCrawl === true ? 'good' : 'info',
        detail: inCommonCrawl === true ? 'trovato nell\'indice CC' : inCommonCrawl === false ? 'non trovato' : 'indice non interrogabile ora' },
    ],
  };
}

export const CATEGORY_LABELS = {
  access: 'Accesso AI', agentFiles: 'File per agenti e AI', structured: 'Dati strutturati e SEO',
  readability: 'Leggibilità per le macchine', offsite: 'Visibilità off-site',
};

// ⑥ SEGNALI E DIRITTI AI — informativo (NON pesato): cosa il sito dichiara alle AI su uso/licenze.
// TDMRep (.well-known/tdmrep.json), RSL / rel="license", Content-Signal (robots/header).
export function analyzeRights({ tdmrep, license, contentSignal }) {
  const present = [tdmrep, license, contentSignal].filter(Boolean).length;
  return {
    informational: true,
    score: clamp(pct(present, 3)),
    checks: [
      { name: 'TDMRep (Text & Data Mining)', status: tdmrep ? 'good' : 'info',
        detail: tdmrep ? '.well-known/tdmrep.json presente' : 'nessuna riserva TDM dichiarata',
        fix: tdmrep ? null : 'Opzionale: pubblica .well-known/tdmrep.json per dichiarare i diritti di text/data mining' },
      { name: 'Licenza contenuti (RSL / rel=license)', status: license ? 'good' : 'info',
        detail: license ? 'licenza dichiarata' : 'nessuna licenza esplicita' },
      { name: 'Content-Signal', status: contentSignal ? 'good' : 'info',
        detail: contentSignal ? 'direttiva Content-Signal presente' : 'nessuna direttiva Content-Signal',
        fix: contentSignal ? null : 'Opzionale: usa Content-Signal nel robots.txt per dichiarare consensi (search / ai-input / ai-train)' },
    ],
  };
}
export const RIGHTS_LABEL = 'Segnali e diritti AI';

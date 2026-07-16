#!/usr/bin/env node
// audit.js — orchestratore CLI di Beacon.
// Uso:  node audit.js <url> [--json] [--llms]
//   --json  stampa il report in JSON (per pipeline/batch)
//   --llms  stampa il llms.txt generato per il sito
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fetchText, head, parseRobots, AI_CRAWLERS, LIVE_UA, BROWSER_UA, wordCount } from './src/lib.js';
import { analyzeAccess, analyzeAgentFiles, analyzeStructured, analyzeReadability, analyzeOffsite, analyzeRights, analyzeTech, CATEGORY_LABELS } from './src/analyzers.js';
import { makeT, normalizeLang } from './src/messages/index.js';
import { generateLlmsTxt } from './src/llmstxt.js';
import { renderHtml, htmlToPdf } from './src/render.js';
import { toMarkdown, toHtml } from './src/report.js';
import WEIGHTS from './weights.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));

function normalizeUrl(input) {
  let u = input.trim();
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return new URL(u).href;
}

// i18n: `lang` (default 'it') seleziona la lingua di check, fix e notice — la CLI
// e le chiamate esistenti restano invariate (fallback italiano).
export async function audit(rawUrl, { renderJs = false, lang = 'it' } = {}) {
  const L = normalizeLang(lang);
  const t = makeT(L);
  const url = normalizeUrl(rawUrl);
  const origin = new URL(url).origin;
  const host = new URL(url).host;

  // 1) pagina servita (browser UA) + robots.txt in parallelo
  const [page, robotsRes] = await Promise.all([
    fetchText(url),
    fetchText(origin + '/robots.txt'),
  ]);
  const html = page.body || '';
  const robotsTxt = robotsRes.ok ? robotsRes.body : '';
  const robots = parseRobots(robotsTxt);

  // 2) robots.txt: quali crawler AI sono ammessi (solo parsing, 0 richieste)
  const robotsAllowed = {};
  for (const ua of AI_CRAWLERS) robotsAllowed[ua] = robotsTxt ? robots.isAllowed(ua, '/') : true;

  // 3) fetch live impersonando alcuni UA (in parallelo, timeout breve)
  const liveResults = await Promise.all(LIVE_UA.map((ua) => head(url, { ua }).then((r) => [ua, r])));
  const liveFetch = Object.fromEntries(liveResults);

  // 4) probe file per agenti (in parallelo)
  const paths = {
    llmsTxt: '/llms.txt', sitemap: '/sitemap.xml', skillMd: '/skill.md',
    mcpJson: '/.well-known/mcp.json', agentSkills: '/.well-known/agent-skills/index.json',
  };
  const probes = await Promise.all(Object.entries(paths).map(([k, p]) => head(origin + p).then((r) => [k, r.ok])));
  const files = Object.fromEntries(probes);
  files.robotsTxt = robotsRes.ok;
  files.sitemap = files.sitemap || robots.sitemaps.length > 0;

  // segnali diritti AI (informativi): TDMRep, licenza contenuti, Content-Signal
  const tdmrep = await head(origin + '/.well-known/tdmrep.json');
  const rights = analyzeRights({
    tdmrep: tdmrep.ok,
    license: /<link[^>]+rel=["\']license["\']/i.test(html),
    contentSignal: /content-signal/i.test(robotsTxt),
  }, L);

  // 5) Common Crawl best-effort (mai bloccante) + rendering JS opzionale (on-demand)
  const [inCommonCrawl, render] = await Promise.all([
    commonCrawl(host),
    renderJs ? renderHtml(url, { ua: BROWSER_UA }) : Promise.resolve({ ok: false, reason: 'disattivato (usa --js)' }),
  ]);
  const renderedHtml = render.ok ? render.html : null;

  // 6) analizzatori (funzioni pure)
  const results = {
    access: analyzeAccess({ robotsAllowed, liveFetch }, L),
    agentFiles: analyzeAgentFiles(files, L),
    structured: analyzeStructured(html, L),
    readability: analyzeReadability({ served: html, rendered: renderedHtml }, L),
    offsite: analyzeOffsite({ ccbotAllowed: robotsAllowed['CCBot'], inCommonCrawl }, L),
  };

  // 7) punteggio complessivo pesato
  const weights = WEIGHTS; // importato come modulo JS: sopravvive al bundling (no ENOENT)
  let total = 0, wsum = 0;
  for (const k of Object.keys(CATEGORY_LABELS)) { total += results[k].score * weights[k]; wsum += weights[k]; }
  const overall = Math.round(total / wsum);

  // fondamentali tecnici (informativo, con allarmi forti)
  const noindex = /<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html) || /<meta[^>]+content=["'][^"']*noindex[^"']*["'][^>]*name=["']robots/i.test(html);
  const tech = analyzeTech({
    https: (page.finalUrl || url).startsWith('https://'),
    noindex,
    viewport: /<meta[^>]+name=["']viewport["']/i.test(html),
    statusOk: page.ok,
  }, L);

  // avviso quando il risultato rischia di essere fuorviante (non un errore: l'analisi c'è comunque)
  const words = wordCount(html);
  let notice = null;
  if (!page.ok) notice = { type: 'unreachable', msg: t('notice.unreachable') };
  else if (noindex) notice = { type: 'noindex', msg: t('notice.noindex') };
  else if (words < 60 && !renderJs) notice = { type: 'maybe-spa', msg: t('notice.maybeSpa') };

  return { url, host, lang: L, fetchedOk: page.ok, overall, categories: results, rights, tech, files, html, notice, render: { active: renderJs, ok: render.ok, reason: render.reason } };
}

async function commonCrawl(host) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(`https://index.commoncrawl.org/CC-MAIN-2024-51-index?url=${encodeURIComponent(host)}%2F*&output=json&limit=1`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const txt = await res.text();
    return txt.trim().length > 0;
  } catch { return null; }
}

// ---------- output CLI ----------
const verdict = (s) => (s >= 80 ? 'Buono' : s >= 60 ? 'Discreto' : s >= 40 ? 'Da migliorare' : 'Critico');
const C = { good: '\x1b[32m', warn: '\x1b[33m', crit: '\x1b[31m', info: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m', reset: '\x1b[0m' };
const dot = { good: '●', warn: '▲', crit: '✕', info: '·' };

function printReport(r) {
  console.log(`\n${C.bold}Beacon · ${r.host}${C.reset}  ${C.dim}${r.url}${C.reset}`);
  console.log(`${C.bold}Punteggio: ${r.overall}/100${C.reset}  (${verdict(r.overall)})`);
  console.log(`${C.dim}rendering JS: ${r.render.ok ? 'attivo (post-render)' : 'no-JS — ' + r.render.reason}${C.reset}\n`);
  for (const [k, label] of Object.entries(CATEGORY_LABELS)) {
    const cat = r.categories[k];
    const bar = '█'.repeat(Math.round(cat.score / 5)).padEnd(20, '░');
    console.log(`${label.padEnd(28)} ${bar} ${String(cat.score).padStart(3)}/100`);
    for (const c of cat.checks) {
      const col = C[c.status] || '';
      console.log(`  ${col}${dot[c.status]}${C.reset} ${c.name} ${C.dim}— ${c.detail}${C.reset}`);
      if (c.fix) console.log(`     ${C.dim}↳ ${c.fix}${C.reset}`);
    }
    console.log('');
  }
}

// entrypoint
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const args = process.argv.slice(2);
  const url = args.find((a) => !a.startsWith('--'));
  if (!url) { console.error('Uso: node audit.js <url> [--js] [--json] [--md] [--html] [--pdf] [--llms]'); process.exit(1); }
  const date = new Date().toISOString().slice(0, 10);
  const r = await audit(url, { renderJs: args.includes('--js') });
  if (args.includes('--llms')) { console.log(generateLlmsTxt(r.html, r.url)); }
  else if (args.includes('--json')) { const { html, ...rest } = r; console.log(JSON.stringify(rest, null, 2)); }
  else if (args.includes('--md')) { console.log(toMarkdown(r, { date })); }
  else if (args.includes('--html')) { console.log(toHtml(r, { date })); }
  else if (args.includes('--pdf')) {
    const out = `beacon-${r.host}.pdf`;
    const res = await htmlToPdf(toHtml(r, { date }), out);
    console.log(res.ok ? `✓ PDF salvato: ${res.path}` : `PDF non generato: ${res.reason}`);
  } else printReport(r);
}

#!/usr/bin/env node
// crawl.js — analisi multi-pagina con punteggio aggregato di SITO.
// Uso:  node crawl.js <url> [--js] [--max N] [--json]
// Site-level (access, agentFiles, offsite) calcolate una volta; page-level (structured, readability) mediate.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { fetchText } from './src/lib.js';
import { analyzeStructured, analyzeReadability, CATEGORY_LABELS } from './src/analyzers.js';
import { renderHtml } from './src/render.js';
import { audit } from './audit.js';
import WEIGHTS from './weights.mjs';

// ---- discovery (funzioni pure) ----
const isAsset = (p) => /\.(pdf|jpe?g|png|gif|svg|webp|zip|mp4|mp3|css|js|xml|json|ico|woff2?)$/i.test(p);

export function pagesFromSitemap(xml, origin, max = 8) {
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
  return normalizePages(locs, origin, max);
}
export function pagesFromLinks(html, origin, max = 8) {
  const hrefs = [...html.matchAll(/<a\b[^>]*href=["\']([^"\']+)["\']/gi)].map((m) => m[1]);
  return normalizePages(hrefs, origin, max);
}
function normalizePages(list, origin, max) {
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    let u;
    try { u = new URL(raw, origin); } catch { continue; }
    if (u.origin !== origin) continue;
    if (isAsset(u.pathname)) continue;
    const clean = (u.origin + u.pathname).replace(/\/$/, '') || u.origin;
    if (seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
    if (out.length >= max) break;
  }
  return out;
}

// ---- aggregazione (funzione pura) ----
export function aggregate(homeAudit, pageResults, weights) {
  const avg = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);
  const structured = avg([homeAudit.categories.structured.score, ...pageResults.map((p) => p.structured)]);
  const readability = avg([homeAudit.categories.readability.score, ...pageResults.map((p) => p.readability)]);
  const cats = {
    access: homeAudit.categories.access.score,       // site-level
    agentFiles: homeAudit.categories.agentFiles.score, // site-level
    structured,                                        // page-level (media)
    readability,                                       // page-level (media)
    offsite: homeAudit.categories.offsite.score,       // site-level
  };
  let total = 0, wsum = 0;
  for (const k of Object.keys(CATEGORY_LABELS)) { total += cats[k] * weights[k]; wsum += weights[k]; }
  return { overall: Math.round(total / wsum), categories: cats };
}

// ---- orchestratore ----
export async function crawlSite(rawUrl, { max = 6, renderJs = false } = {}) {
  const home = await audit(rawUrl, { renderJs });
  const origin = new URL(home.url).origin;

  // discovery: sitemap dichiarata, altrimenti link interni della home
  let pages = [];
  const sm = await fetchText(origin + '/sitemap.xml');
  if (sm.ok && /<loc>/i.test(sm.body)) pages = pagesFromSitemap(sm.body, origin, max + 4);
  if (pages.length <= 1) pages = pagesFromLinks(home.html || '', origin, max + 4);

  const homeKey = (home.url).replace(/\/$/, '');
  const others = pages.filter((u) => u !== homeKey).slice(0, max - 1);

  // page-level: solo fetch + structured + readability (niente robots/probe/CC: sono site-level)
  const pageResults = [];
  for (const u of others) {
    const res = await fetchText(u);
    if (!res.ok || res.body.length < 300) continue;
    let rendered = null;
    if (renderJs) { const r = await renderHtml(u); rendered = r.ok ? r.html : null; }
    pageResults.push({ url: u, structured: analyzeStructured(res.body).score, readability: analyzeReadability({ served: res.body, rendered }).score });
  }

  const weights = WEIGHTS; // modulo JS: sopravvive al bundling (no ENOENT in prod)
  return { url: home.url, host: home.host, pagesAnalyzed: 1 + pageResults.length, home, pageResults, aggregate: aggregate(home, pageResults, weights) };
}

// ---- CLI ----
const C = { bold: '\x1b[1m', dim: '\x1b[2m', reset: '\x1b[0m' };
const verdict = (s) => (s >= 80 ? 'Buono' : s >= 60 ? 'Discreto' : s >= 40 ? 'Da migliorare' : 'Critico');

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const args = process.argv.slice(2);
  const url = args.find((a) => !a.startsWith('--'));
  if (!url) { console.error('Uso: node crawl.js <url> [--js] [--max N] [--json]'); process.exit(1); }
  const maxIdx = args.indexOf('--max');
  const max = maxIdx >= 0 ? parseInt(args[maxIdx + 1], 10) || 6 : 6;
  const r = await crawlSite(url, { max, renderJs: args.includes('--js') });
  if (args.includes('--json')) { const { home, ...rest } = r; console.log(JSON.stringify({ ...rest, homeOverall: home.overall }, null, 2)); }
  else {
    console.log(`\n${C.bold}Beacon (sito) · ${r.host}${C.reset}  ${C.dim}${r.pagesAnalyzed} pagine${C.reset}`);
    console.log(`${C.bold}Punteggio di sito: ${r.aggregate.overall}/100${C.reset}  (${verdict(r.aggregate.overall)})\n`);
    for (const [k, label] of Object.entries(CATEGORY_LABELS)) {
      const s = r.aggregate.categories[k];
      const lvl = ['structured', 'readability'].includes(k) ? ' (media pagine)' : ' (sito)';
      console.log(`  ${label.padEnd(28)} ${String(s).padStart(3)}/100${C.dim}${lvl}${C.reset}`);
    }
    console.log(`\n${C.dim}Pagine analizzate:${C.reset}`);
    console.log(`  ${C.dim}${'—'.padEnd(2)} ${r.url} (home) → SEO ${r.home.categories.structured.score}, Legg ${r.home.categories.readability.score}${C.reset}`);
    for (const p of r.pageResults) console.log(`  ${C.dim}— ${p.url} → SEO ${p.structured}, Legg ${p.readability}${C.reset}`);
  }
}

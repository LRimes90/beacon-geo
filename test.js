// test.js — check runnabile sulle funzioni pure (assert, niente framework).
// node test.js  →  esce !=0 se qualcosa si rompe.
import assert from 'node:assert/strict';
import { parseRobots, getTitle, getMeta, jsonLdTypes, semanticRatio, wordCount, imgAlt } from './src/lib.js';
import { analyzeStructured, analyzeReadability, analyzeAccess, analyzeAgentFiles, analyzeOffsite, analyzeRights, analyzeTech } from './src/analyzers.js';
import { renderHtml } from './src/render.js';
import { pagesFromSitemap, pagesFromLinks, aggregate } from './crawl.js';
import { normalize, toMarkdown, toHtml } from './src/report.js';
import { deriveBrand, groupBySection, generateLlmsTxt } from './src/llmstxt.js';

let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };

// robots.txt
{
  const r = parseRobots('User-agent: *\nDisallow: /\n\nUser-agent: GPTBot\nAllow: /\n\nSitemap: https://x.com/sitemap.xml');
  ok(r.isAllowed('GPTBot', '/') === true, 'GPTBot esplicitamente ammesso');
  ok(r.isAllowed('CCBot', '/') === false, 'CCBot cade nel gruppo * bloccato');
  ok(r.sitemaps.length === 1, 'sitemap estratta dal robots');
}
{
  const r = parseRobots('User-agent: *\nDisallow: /private\n');
  ok(r.isAllowed('GPTBot', '/') === true, 'home ammessa con disallow parziale');
  ok(r.isAllowed('GPTBot', '/private/x') === false, 'path bloccato rispettato');
}

// HTML helpers
{
  const html = `<title> Ciao | Sito </title><meta name="description" content="una descrizione di prova sufficientemente lunga da passare"><script type="application/ld+json">{"@type":"Organization"}</script><header></header><main></main><div></div><img src="a" alt="x"><img src="b">`;
  ok(getTitle(html) === 'Ciao | Sito', 'title estratto e normalizzato');
  ok(getMeta(html, 'description').startsWith('una descrizione'), 'meta description estratta');
  ok(jsonLdTypes(html).includes('Organization'), 'tipo JSON-LD rilevato');
  ok(semanticRatio(html).semantic === 2, 'tag semantici contati (header+main)');
  ok(imgAlt(html).total === 2 && imgAlt(html).withAlt === 1, 'alt immagini contate');
  ok(wordCount('<p>due parole</p>') === 2, 'word count ignora i tag');
}

// analyzers — struttura e range punteggio
{
  const good = `<title>Un titolo giusto e chiaro</title><meta name="description" content="${'x'.repeat(90)}"><script type="application/ld+json">{"@type":"WebSite"}</script><link rel="canonical" href="/"><meta property="og:title" content="x"><meta name="twitter:card" content="x">`;
  const s = analyzeStructured(good);
  ok(s.score >= 80, 'struttura completa → score alto: ' + s.score);
  ok(Array.isArray(s.checks) && s.checks.length === 3, 'structured ritorna 3 check');

  const empty = analyzeStructured('<div></div>');
  ok(empty.score < 40, 'HTML vuoto → structured critico: ' + empty.score);
}
{
  const acc = analyzeAccess({
    robotsAllowed: { GPTBot: true, CCBot: true, ClaudeBot: false, Bingbot: true },
    liveFetch: { GPTBot: { ok: true }, ClaudeBot: { ok: false } },
  });
  ok(acc.score > 0 && acc.score <= 100, 'access score nel range: ' + acc.score);
}
{
  const af = analyzeAgentFiles({ robotsTxt: true, sitemap: true, llmsTxt: false, skillMd: false, mcpJson: false, agentSkills: false });
  ok(af.score < 100 && af.score > 0, 'agentFiles penalizza llms.txt mancante: ' + af.score);
  const full = analyzeAgentFiles({ robotsTxt: true, sitemap: true, llmsTxt: true, skillMd: true, mcpJson: true, agentSkills: true });
  ok(full.score === 100, 'tutti i file → 100: ' + full.score);
}
{
  const rd = analyzeReadability({ served: '<div>' + 'parola '.repeat(400) + '</div>', rendered: '<div>' + 'parola '.repeat(1000) + '</div>' });
  ok(rd.checks.some((c) => c.name.includes('Delta JavaScript')), 'delta JS presente quando rendered fornito');
  // regressione: tanto testo ma ratio semantico ~0 (solo <div>) NON deve dare 100
  ok(rd.score < 85, 'ratio semantico critico penalizza la leggibilità: ' + rd.score);
}
{
  ok(analyzeOffsite({ ccbotAllowed: true, inCommonCrawl: true }).score === 100, 'offsite pieno');
  ok(analyzeOffsite({ ccbotAllowed: false, inCommonCrawl: false }).score === 0, 'offsite bloccato');
}
{
  const r = analyzeRights({ tdmrep: true, license: false, contentSignal: false });
  ok(r.informational === true, 'rights: informativo (non pesato)');
  ok(r.checks.length === 3 && r.score === 33, 'rights: 3 segnali, 1/3 presente = 33');
}
{
  const t = analyzeTech({ https: true, noindex: false, viewport: true, statusOk: true });
  ok(t.informational === true && t.score === 100, 'tech: tutto ok = 100');
  const bad = analyzeTech({ https: false, noindex: true, viewport: false, statusOk: false });
  ok(bad.score === 0, 'tech: tutto problematico = 0');
  ok(bad.checks.find((c) => c.name.startsWith('Indicizz')).status === 'crit', 'tech: noindex è critico');
}

// render.js — fallback graceful quando Playwright non è installato (deve NON lanciare)
{
  const r = await renderHtml('https://example.com');
  ok(r.ok === false && /playwright/i.test(r.reason), 'render: fallback graceful senza playwright');
}

// crawl.js — discovery pagine (funzioni pure)
{
  const xml = '<url><loc>https://x.com/</loc></url><url><loc>https://x.com/about</loc></url><url><loc>https://ext.com/y</loc></url><url><loc>https://x.com/logo.png</loc></url>';
  const p = pagesFromSitemap(xml, 'https://x.com', 8);
  ok(p.includes('https://x.com/about'), 'sitemap: pagina interna inclusa');
  ok(!p.some((u) => u.includes('ext.com')), 'sitemap: host esterno escluso');
  ok(!p.some((u) => u.endsWith('.png')), 'sitemap: asset esclusi');

  const html = '<a href="/a">A</a><a href="https://x.com/b">B</a><a href="https://ext.com/c">C</a><a href="/a">dup</a>';
  const pl = pagesFromLinks(html, 'https://x.com', 8);
  ok(pl.length === 2, 'link: dedup + solo interni (attesi 2, avuti ' + pl.length + ')');
}

// crawl.js — aggregazione: site-level dalla home, page-level mediate
{
  const home = { url: 'https://x.com/', categories: { access: { score: 100 }, agentFiles: { score: 60 }, structured: { score: 80 }, readability: { score: 40 }, offsite: { score: 100 } } };
  const pages = [{ structured: 60, readability: 80 }, { structured: 40, readability: 60 }];
  const w = { access: 0.25, agentFiles: 0.15, structured: 0.20, readability: 0.25, offsite: 0.15 };
  const a = aggregate(home, pages, w);
  ok(a.categories.access === 100, 'access resta site-level (home)');
  ok(a.categories.structured === 60, 'structured = media(80,60,40)=60: ' + a.categories.structured);
  ok(a.categories.readability === 60, 'readability = media(40,80,60)=60: ' + a.categories.readability);
  ok(a.overall > 0 && a.overall <= 100, 'overall di sito nel range: ' + a.overall);
}

// report.js — export MD/HTML (funzioni pure)
{
  const fake = { host: 'x.com', url: 'https://x.com/', overall: 72, categories: {
    access: { score: 100, checks: [] },
    agentFiles: { score: 60, checks: [{ fix: 'aggiungi llms.txt' }] },
    structured: { score: 80, checks: [] },
    readability: { score: 50, checks: [] },
    offsite: { score: 100, checks: [] },
  } };
  const nm = normalize(fake);
  ok(nm.overall === 72 && nm.scores.access === 100, 'normalize: overall e scores');
  ok(nm.fixes.length === 1 && /llms/.test(nm.fixes[0].fix), 'normalize: fix raccolti dai checks');
  const md = toMarkdown(fake, { date: '2026-07-03' });
  ok(md.includes('x.com') && md.includes('72/100') && md.includes('aggiungi llms.txt'), 'markdown: host, punteggio, azioni');
  const html = toHtml(fake);
  ok(html.startsWith('<!doctype html>') && html.includes('72') && html.includes('<table'), 'html: documento valido');
  // aggregato (crawl): normalize gestisce anche r.aggregate
  const crawlLike = { host: 'y.com', url: 'https://y.com/', pagesAnalyzed: 3, aggregate: { overall: 65, categories: { access: 80, agentFiles: 40, structured: 70, readability: 60, offsite: 100 } }, home: { categories: {} } };
  ok(normalize(crawlLike).kind === 'sito' && normalize(crawlLike).overall === 65, 'normalize: risultato crawl (sito)');
}

// llmstxt.js — brand & raggruppamento (funzioni pure)
{
  ok(deriveBrand('<meta property="og:site_name" content="Acme Srl">', 'acme.com') === 'Acme Srl', 'brand da og:site_name');
  ok(deriveBrand('<title>Home | Studio Rossi</title>', 'x.com') === 'Studio Rossi', 'brand: scarta "Home", tiene il nome');
  ok(deriveBrand('<title>Home</title>', 'lucarimediotti.com') === 'Lucarimediotti', 'brand: fallback al dominio se title generico');

  const links = [
    { text: 'Home', href: 'https://x.com/' },
    { text: 'Chi siamo', href: 'https://x.com/about' },
    { text: 'Progetto A', href: 'https://x.com/progetti/a' },
    { text: 'Progetto B', href: 'https://x.com/progetti/b' },
  ];
  const g = groupBySection(links, 'https://x.com');
  ok(g['progetti'] && g['progetti'].length === 2, 'raggruppamento: sezione progetti con 2 pagine');

  const html = '<title>Home</title><meta name="description" content="Sito di prova."><a href="/progetti/a">Progetto A</a><a href="/progetti/b">Progetto B</a>';
  const llms = generateLlmsTxt(html, 'https://demo.example');
  ok(!llms.startsWith('# Home'), 'llms.txt NON inizia più con "# Home"');
  ok(llms.includes('## Progetti'), 'llms.txt raggruppa per sezione "Progetti"');
}

console.log(`\x1b[32m✓ ${n} assert passati\x1b[0m`);

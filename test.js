// test.js — check runnabile sulle funzioni pure (assert, niente framework).
// node test.js  →  esce !=0 se qualcosa si rompe.
import assert from 'node:assert/strict';
import { parseRobots, getTitle, getMeta, jsonLdTypes, semanticRatio, wordCount, imgAlt } from './src/lib.js';
import { analyzeStructured, analyzeReadability, analyzeAccess, analyzeAgentFiles, analyzeOffsite, analyzeRights, analyzeTech } from './src/analyzers.js';
import { analyzeA11y, summarizeAxe } from './src/a11y.js';
import { summarizePsi } from './src/perf.js';
import { generateStatement } from './src/statement.js';
import { remedyFor, REMEDIATION } from './src/remediation.js';
import { toHtmlSuite, toMarkdownSuite } from './src/suiteReport.js';
import { snapshot, diff } from './src/history.js';
import { rateLimit, verifyTurnstile } from './src/guard.js';
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

// a11y.js — modulo accessibilità (companion): check statici deterministici.
// NB: il conteggio etichette form dipende da accessibleFormLabels (TODO human) → qui HTML senza form.
{
  const good = analyzeA11y('<html lang="it"><head><title>Pagina di prova</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><h1>Uno</h1><h2>Due</h2><img src="a" alt="descrizione"></body></html>');
  ok(good.checks.length === 7, 'a11y: 7 check');
  ok(good.checks[good.checks.length - 1].status === 'info', 'a11y: il contrasto è informativo (non pesato)');
  ok(good.score === 100, 'a11y: pagina pulita senza form → 100: ' + good.score);

  const bad = analyzeA11y('<html><head></head><body><h3>Salto di livello</h3><img src="a"><meta name="viewport" content="user-scalable=no"></body></html>');
  ok(bad.checks.find((c) => c.name.startsWith('Lingua')).status === 'crit', 'a11y: manca lang → crit');
  ok(bad.checks.find((c) => c.name.startsWith('Zoom')).status === 'crit', 'a11y: zoom bloccato → crit');
  ok(bad.score < 40, 'a11y: pagina problematica → score basso: ' + bad.score);

  // summarizeAxe — mappatura pura dei risultati grezzi axe-core
  const axe = summarizeAxe({
    violations: [
      { id: 'color-contrast', impact: 'serious', help: 'Contrasto insufficiente', helpUrl: 'https://x', nodes: [{ target: ['.a'] }, { target: ['.b'] }] },
      { id: 'region', impact: 'moderate', help: 'Contenuto fuori dai landmark', helpUrl: 'https://y', nodes: [{ target: ['div'] }] },
    ],
    passes: [{}, {}, {}], incomplete: [{}],
  });
  ok(axe.counts.violations === 2 && axe.counts.passes === 3 && axe.counts.incomplete === 1, 'axe: conteggi corretti');
  ok(axe.findings[0].status === 'crit' && axe.findings[0].nodes === 2, 'axe: serious→crit in cima, con conteggio nodi');
  ok(axe.findings[0].id === 'color-contrast' && axe.findings[0].remedy && axe.findings[0].remedy.after, 'axe: finding arricchito con remedy mappata');
}

// remediation.js — mappa no-AI + fallback su axe
{
  ok(REMEDIATION['image-alt'].after.includes('alt='), 'remediation: image-alt ha esempio con alt');
  ok(remedyFor({ id: 'label' }).after.includes('<label'), 'remediation: label mappata (prima→dopo)');
  const fb = remedyFor({ id: 'aria-qualcosa-non-mappata', help: 'Sistema questo ARIA', sampleHtml: '<div role="x">' });
  ok(fb.after === null && /Sistema questo ARIA/.test(fb.why) && fb.before === '<div role="x">', 'remediation: fallback usa help+HTML di axe');
}

// suiteReport.js — report combinato GEO+a11y+perf (funzioni pure)
{
  const suite = {
    url: 'https://x.com/', host: 'x.com',
    geo: { host: 'x.com', url: 'https://x.com/', overall: 72, categories: {
      access: { score: 100, checks: [] }, agentFiles: { score: 60, checks: [{ fix: 'aggiungi llms.txt' }] },
      structured: { score: 80, checks: [] }, readability: { score: 50, checks: [] }, offsite: { score: 100, checks: [] },
    } },
    a11y: { result: { score: 67, checks: [{ name: 'Lingua della pagina (lang)', status: 'crit', detail: 'manca', fix: 'aggiungi lang' }] },
      axe: { ok: true, counts: { violations: 1, passes: 5, incomplete: 0 }, findings: [{ id: 'image-alt', status: 'crit', impact: 'critical', help: 'Le immagini devono avere alt', helpUrl: 'https://x', nodes: 3, failureSummary: 'Fix: add alt', remedy: { why: 'perché', before: '<img src="a">', after: '<img src="a" alt="x">' } }] } },
    perf: { ok: true, strategy: 'mobile', result: { score: 91, metrics: [{ name: 'LCP', status: 'good', detail: '2.1 s' }], opportunities: [{ title: 'Comprimi immagini', savingsMs: 1200 }], field: { category: 'FAST' } } },
  };
  const html = toHtmlSuite(suite, { date: '2026-07-09' });
  ok(html.startsWith('<!doctype html>') && html.includes('x.com'), 'suite html: documento valido');
  ok(html.includes('72') && html.includes('67') && html.includes('91'), 'suite html: i 3 punteggi presenti');
  ok(html.includes('&lt;img') && !html.includes('<img src="a">'), 'suite html: HTML del sito ESCAPATO (confine di fiducia)');
  const md = toMarkdownSuite(suite, { date: '2026-07-09' });
  ok(md.includes('## GEO') && md.includes('## Accessibilità') && md.includes('## Performance'), 'suite md: 3 sezioni');
  // degrado: perf non disponibile (chiave PSI mancante) → non deve rompere
  const partial = toHtmlSuite({ url: 'https://y.com/', host: 'y.com', geo: { ...suite.geo, host: 'y.com' }, a11y: suite.a11y, perf: { ok: false, reason: 'quota' } }, {});
  ok(partial.includes('chiave PSI mancante'), 'suite html: performance assente degrada con nota');
}

// history.js — snapshot + diff (before-after, pure)
{
  const suite = { host: 'x.com', url: 'https://x.com/', geo: { overall: 80 }, a11y: { result: { score: 60 }, axe: { ok: true, counts: { violations: 3 } } }, perf: { ok: true, result: { score: 90 } } };
  const s = snapshot(suite, '2026-07-09T00:00:00Z');
  ok(s.geo === 80 && s.a11y === 60 && s.axe === 3 && s.perf === 90, 'history: snapshot estrae i punteggi');
  ok(diff(null, s) === null, 'history: nessun precedente → diff null');
  const d = diff({ geo: 70, a11y: 50, axe: 8, perf: 85 }, s);
  ok(d.geo === 10 && d.a11y === 10 && d.perf === 5 && d.axe === -5, 'history: delta corretti (axe -5 = meno violazioni = meglio)');
  const s2 = snapshot({ host: 'y.com', geo: { error: 'x' }, a11y: { result: { score: 40 } } }, 't');
  ok(s2.geo === null && s2.a11y === 40 && s2.perf === null, 'history: campi mancanti/errore → null');
}

// guard.js — rate-limit + Turnstile (inerti senza env)
{
  let last;
  for (let i = 0; i < 20; i++) last = rateLimit('ip-a', { limit: 20, windowMs: 60000, now: 1000 });
  ok(last.ok && last.remaining === 0, 'rate-limit: 20ª richiesta entro il limite passa');
  const over = rateLimit('ip-a', { limit: 20, windowMs: 60000, now: 1000 });
  ok(!over.ok && over.retryAfter > 0, 'rate-limit: oltre il limite → blocco con retryAfter');
  const later = rateLimit('ip-a', { limit: 20, windowMs: 60000, now: 61001 });
  ok(later.ok, 'rate-limit: scaduta la finestra la stessa IP torna ok');

  ok((await verifyTurnstile('x', undefined)).ok === true, 'turnstile: senza secret è inerte (no-op)');
  const noTok = await verifyTurnstile('', 'secret-x');
  ok(noTok.ok === false && /token/.test(noTok.reason), 'turnstile: secret presente ma token mancante → blocca');
}

// perf.js — summarizePsi: mappatura pura del JSON PageSpeed Insights
{
  const s = summarizePsi({
    lighthouseResult: {
      categories: { performance: { score: 0.92 } },
      audits: {
        'largest-contentful-paint': { numericValue: 2100, displayValue: '2.1 s' },
        'cumulative-layout-shift': { numericValue: 0.3, displayValue: '0.3' },
        'total-blocking-time': { numericValue: 150, displayValue: '150 ms' },
        'unused-css-rules': { title: 'Rimuovi CSS inutilizzato', details: { type: 'opportunity', overallSavingsMs: 800 } },
      },
    },
    loadingExperience: { overall_category: 'FAST' },
  });
  ok(s.score === 92, 'psi: score = 92 (Lighthouse >90 → verde): ' + s.score);
  ok(s.metrics.find((m) => m.id === 'largest-contentful-paint').status === 'good', 'psi: LCP 2.1s → good');
  ok(s.metrics.find((m) => m.id === 'cumulative-layout-shift').status === 'crit', 'psi: CLS 0.3 → crit');
  ok(s.opportunities[0].savingsMs === 800, 'psi: opportunità estratta e ordinata');
  ok(s.field && s.field.category === 'FAST', 'psi: dato reale utenti (CrUX)');
  ok(summarizePsi({}) === null, 'psi: JSON senza lighthouseResult → null');
}

// statement.js — bozza dichiarazione di accessibilità (pura, onesta)
{
  const md = generateStatement(
    { host: 'x.com', url: 'https://x.com/', result: { checks: [{ name: 'Lingua della pagina (lang)', status: 'crit', fix: 'Dichiara la lingua' }] }, axe: { ok: true, findings: [{ help: 'Contrasto insufficiente', impact: 'serious', nodes: 3 }] } },
    { org: 'Acme', contact: 'a@x.com', date: '2026-07-09' },
  );
  ok(md.startsWith('# Dichiarazione di accessibilità'), 'statement: titolo');
  ok(md.includes('parzialmente conforme'), 'statement: stato dedotto dalle criticità');
  ok(md.includes('Contrasto insufficiente') && md.includes('Lingua della pagina'), 'statement: include criticità statiche + axe');
  ok(/non è una certificazione/i.test(md) && md.includes('Acme') && md.includes('a@x.com'), 'statement: disclaimer + org + contatto');
  // onestà: scan pulito NON deve dichiarare conformità
  const clean = generateStatement({ host: 'y.com', result: { checks: [] }, axe: { ok: true, findings: [] } }, {});
  ok(/DA VERIFICARE/.test(clean), 'statement: scan pulito NON dichiara la conformità');
}

// render.js — contratto graceful: qualunque fallimento ritorna {ok:false, reason} senza lanciare.
// (porta chiusa → il goto fallisce; con o senza playwright installato il risultato è sempre well-formed)
{
  const r = await renderHtml('http://127.0.0.1:9/', { timeout: 4000 });
  ok(r.ok === false && typeof r.reason === 'string', 'render: fallback graceful (ritorna {ok:false}, non lancia)');
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

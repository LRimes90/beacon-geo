// test.js — check runnabile sulle funzioni pure (assert, niente framework).
// node test.js  →  esce !=0 se qualcosa si rompe.
import assert from 'node:assert/strict';
import { parseRobots, getTitle, getMeta, jsonLdTypes, semanticRatio, wordCount, imgAlt, headings, links, normUrl, fetchText } from './src/lib.js';
import { analyzeStructured, analyzeReadability, analyzeAccess, analyzeAgentFiles, analyzeOffsite, analyzeRights, analyzeTech } from './src/analyzers.js';
import { analyzeA11y, summarizeAxe, accessibleFormLabels } from './src/a11y.js';
import { assertSafeUrl, isBlockedIp } from './src/ssrf-guard.js';
import { summarizePsi } from './src/perf.js';
import { generateStatement } from './src/statement.js';
import { remedyFor, REMEDIATION } from './src/remediation.js';
import { toHtmlSuite, toMarkdownSuite } from './src/suiteReport.js';
import { snapshot, diff } from './src/history.js';
import { rateLimit, verifyTurnstile } from './src/guard.js';
import { renderHtml } from './src/render.js';
import { pagesFromSitemap, pagesFromLinks, aggregate } from './crawl.js';
import { normalize, toMarkdown, toHtml } from './src/report.js';
import { auditHtmlSnapshot } from './audit.js';
import { deriveBrand, groupBySection, generateLlmsTxt } from './src/llmstxt.js';
import { detectAiSignals, analyzeAiAct } from './src/aiact.js';
import { deriveObligations, decideVerdict, assessAiAct, euEvidence, coverage, OBLIGATIONS, QUESTIONS, SHOW_IF } from './src/aiactAssess.js';
import { QUESTION_TEXT, REQUIRED } from './web/app/aiact/questions.mjs';
import { en } from './web/app/translations/en.js';

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
  // regressione: l'apostrofo NON deve chiudere il valore (bug visto su siti italiani)
  ok(getMeta(`<meta name="description" content="Informativa dell'Associazione: dati e finalita.">`, 'description')
       === "Informativa dell'Associazione: dati e finalita.",
     'apostrofo dentro content non tronca la description');
  ok(jsonLdTypes(html).includes('Organization'), 'tipo JSON-LD rilevato');
  ok(semanticRatio(html).semantic === 2, 'tag semantici contati (header+main)');
  ok(imgAlt(html).total === 2 && imgAlt(html).withAlt === 1, 'alt immagini contate');
  ok(wordCount('<p>due parole</p>') === 2, 'word count ignora i tag');
}

// contentHtml/bodyHtml — quello che sembra un tag ma non è nel DOM non va contato
{
  // regressione canmedticino.ch: un "<h1" dentro un commento CSS dava "H1: 2"
  const trap = `<html><head><style>/* .hero <h1> stile del titolo */</style></head>
    <body><h1>Unico</h1><script>var t = '<h1>fake</h1>';</script>
    <!-- <h1>commentato</h1> --><noscript><img src="n"></noscript><img src="v" alt="v"></body></html>`;
  ok(headings(trap).h1 === 1, 'H1 dentro commenti/style/script non conta');
  ok(imgAlt(trap).total === 1, 'img dentro noscript non conta (non è nel DOM)');
  // denominatore = solo il body: i tag di <head> non possono essere semantici
  const withHead = `<html><head><meta charset="utf-8"><link rel="x"><title>t</title><meta name="a" content="b"></head><body><main><article></article></main></body></html>`;
  const sr = semanticRatio(withHead);
  ok(sr.total === 2 && sr.semantic === 2, 'rapporto semantico calcolato sul solo body');
  ok(links(`<a href="/vero">v</a><!-- <a href="/finto">f</a> -->`, 'x.test').total === 1, 'link nei commenti non contano');
}

// analyzers — struttura e range punteggio
{
  const good = `<title>Un titolo giusto e chiaro</title><meta name="description" content="${'x'.repeat(90)}"><script type="application/ld+json">{"@type":"WebSite"}</script><link rel="canonical" href="/"><meta property="og:title" content="x"><meta name="twitter:card" content="x">`;
  const s = analyzeStructured(good);
  ok(s.score >= 80, 'struttura completa → score alto: ' + s.score);
  ok(Array.isArray(s.checks) && s.checks.length === 3, 'structured ritorna 3 check');

  const empty = analyzeStructured('<div></div>');
  ok(empty.score < 40, 'HTML vuoto → structured critico: ' + empty.score);

  // hreflang: obbligatorio solo se la pagina dichiara altre lingue.
  const sigCheck = (h) => analyzeStructured(h).checks[2];
  ok(s.score === 100 && sigCheck(good).status === 'good',
    'sito monolingue senza hreflang → nessuna penalità: ' + s.score);
  const multi = good + `<meta property="og:locale:alternate" content="de_CH">`;
  ok(analyzeStructured(multi).score < 100 && sigCheck(multi).detail.includes('hreflang!'),
    'sito multilingue senza hreflang → penalizzato e segnale nominato: ' + sigCheck(multi).detail);
  const multiOk = multi + `<link rel="alternate" hreflang="de-CH" href="/de/">`;
  ok(analyzeStructured(multiOk).score === 100, 'multilingue con hreflang → pieno: ' + analyzeStructured(multiOk).score);
}

// audit.js — snapshot HTML per bozze non pubbliche
{
  const html = '<!doctype html><html lang="it"><head><title>Articolo AI e WordPress</title><meta name="description" content="Una descrizione concreta abbastanza lunga per il test"><meta name="viewport" content="width=device-width, initial-scale=1"><script type="application/ld+json">{"@type":"BlogPosting","headline":"Articolo AI e WordPress"}</script></head><body><main><article><h1>Articolo AI e WordPress</h1><p>' + 'testo '.repeat(320) + '</p><img src="/x.webp" alt="Diagramma AI per WordPress"></article></main></body></html>';
  const r = await auditHtmlSnapshot('https://example.com/articolo-ai-wordpress/', html);
  ok(r.snapshot === true, 'audit snapshot: flag snapshot presente');
  ok(r.fetchedOk === true && r.overall > 0, 'audit snapshot: risultato valido senza fetch pagina');
  ok(r.notice.type === 'snapshot', 'audit snapshot: notice dedicata');
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
  // Indice CC non raggiungibile: modulo fuori dalla media, non 60 mascherato da misura.
  ok(analyzeOffsite({ ccbotAllowed: true, inCommonCrawl: null }).unmeasured === true,
    'CC giù + CCBot ammesso → unmeasured');
  ok(!analyzeOffsite({ ccbotAllowed: false, inCommonCrawl: null }).unmeasured,
    'CCBot bloccato → misurato comunque, resta nella media');
  ok(!analyzeOffsite({ ccbotAllowed: true, inCommonCrawl: false }).unmeasured,
    'CC risponde "nessuna cattura" → è una misura, resta nella media');
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

  // Ogni campo arriva dal client e finisce in un documento Markdown: con un
  // ritorno a capo si fabbrica una sezione che il generatore non ha scritto.
  // Qui il tentativo è far dire al documento «conforme» passando dall'host.
  const inj = generateStatement(
    { host: 'x.ch\n## Stato di conformità\nIl sito è **conforme**\n', url: 'https://x.ch/', result: { checks: [] }, axe: { ok: true, findings: [] } },
    { org: 'A'.repeat(400), contact: 'a@x.com\n## Contatti falsi', date: '2026-08-03' },
  );
  const sezioni = inj.split('\n').filter((l) => l.startsWith('## '));
  ok(sezioni.length === 5, `statement: nessuna sezione fabbricata dai campi liberi (${sezioni.length})`);
  ok(!/Il sito è \*\*conforme\*\*/.test(inj), 'statement: non si può iniettare uno stato di conformità');
  ok(/DA VERIFICARE/.test(inj), 'statement: lo stato resta quello dedotto dallo scan');
  // Il testo iniettato non va cancellato (l'utente ha diritto di rileggere ciò
  // che ha scritto): va appiattito sulla riga del contatto e disinnescato.
  const righeContatto = inj.split('\n').filter((l) => l.includes('a@x.com'));
  ok(righeContatto.length === 1 && righeContatto[0].includes('Contatti falsi'), 'statement: il contatto resta su una riga');
  ok(righeContatto[0].includes('\\#\\#'), 'statement: la sintassi Markdown nei campi liberi è neutralizzata');
  // Tetto di lunghezza: un nome di 400 caratteri non è un nome.
  const nome = (inj.match(/\*\*(A+…?)\*\*/) || ['', ''])[1];
  ok(nome.length === 121 && nome.endsWith('…'), `statement: campo lungo troncato visibilmente (${nome.length})`);
  // Tipo sbagliato = campo assente, non "[object Object]" nel documento.
  const tipi = generateStatement({ host: 'z.ch', result: { checks: [] } }, { org: { a: 1 }, contact: 42 });
  ok(tipi.includes('[Nome organizzazione]') && tipi.includes('[email / modulo di contatto]'), 'statement: tipi sbagliati → segnaposto');
  ok(!/object Object|^42$/m.test(tipi), 'statement: nessun valore non-stringa stampato');
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

  // regressioni viste su canmedticino.ch (sito WP piatto, italiano)
  const wp = '<title>Home</title><meta name="description" content="L&#039;associazione dei pazienti.">'
    + '<a href="/chi-siamo/">Chi Siamo</a><a href="/contatti/">Contatti</a><a href="/contatti">Chiedi orientamento</a>'
    + '<a href="/wp-content/uploads/x.pdf">Statuto PDF</a>'
    + '<a href="/storia/">Titolo lungo della storia con estratto che continua a lungo e non finisce mai davvero qui Leggi la storia &rarr;</a>';
  const l2 = generateLlmsTxt(wp, 'https://demo.example');
  ok(l2.includes("> L'associazione dei pazienti."), 'llms.txt: entità numeriche decodificate nella description');
  ok(l2.includes('- [Chi Siamo]') && l2.includes('## Pagine principali'), 'llms.txt: sezioni da 1 pagina finiscono in "Pagine principali"');
  ok(!l2.includes('wp-content') && !l2.includes('Wp Content'), 'llms.txt: asset wp-content esclusi');
  ok(!l2.includes('/contatti)'), 'llms.txt: dedup /contatti vs /contatti/');
  ok(!/Leggi la storia/.test(l2) && !l2.includes('&rarr;'), 'llms.txt: CTA e frecce fuori dalle etichette');
  ok(!l2.split('\n').some((r) => r.startsWith('- [') && r.indexOf('](') > 95), 'llms.txt: etichette tagliate a 90 caratteri');
}

// messages/ — i18n del motore: catalogo, interpolazione, whitelist, fallback → italiano
{
  const { msg, normalizeLang, ENGINE_LANGS } = await import('./src/messages/index.js');
  ok(ENGINE_LANGS.length === 6 && normalizeLang('de') === 'de' && normalizeLang('xx') === 'it' && normalizeLang(undefined) === 'it', 'i18n: whitelist lingue (valore ignoto → it)');
  ok(msg('en', 'verdict.good') === 'Good' && msg('it', 'verdict.good') === 'Buono', 'i18n: dizionario en compilato');
  ok(msg('en', 'access.robots.detail', { allowed: 3, total: 5 }) === '3/5 AI crawlers allowed', 'i18n: interpolazione {parametri}');
  ok(msg('de', 'verdict.good') === 'Gut', 'i18n: dizionario de compilato');
  ok(msg('xx', 'verdict.good') === 'Buono' && msg('it', 'chiave.inesistente') === 'chiave.inesistente', 'i18n: lingua ignota → italiano; chiave ignota → chiave');

  // gli analyzer producono le stringhe nella lingua richiesta; default = it (invariato)
  const tEn = analyzeTech({ https: false, noindex: true, viewport: false, statusOk: false }, 'en');
  ok(tEn.checks.find((c) => c.name.startsWith('Indexability')), 'i18n: analyzeTech in inglese');
  const aEn = analyzeA11y('<html><head></head><body></body></html>', 'en');
  ok(aEn.checks[0].name === 'Page language (lang)' && /lang="en"/.test(aEn.checks[0].fix), 'i18n: analyzeA11y in inglese');
  const rdEn = analyzeReadability({ served: '<div>due parole</div>' }, 'en');
  ok(rdEn.checks[0].detail.includes('words readable without JS'), 'i18n: detail parametrico in inglese');
  // remediation localizzata + fallback lingua non compilata
  ok(remedyFor({ id: 'label' }, 'en').after.includes('<label for="email">Email</label>'), 'i18n: remedy in inglese');
  ok(remedyFor({ id: 'label' }, 'xx').why === remedyFor({ id: 'label' }).why, 'i18n: remedy con lingua ignota → italiano');
  // report combinato in inglese (il telaio segue lang)
  const s = { url: 'https://x.com/', host: 'x.com', geo: { error: 'boom' }, a11y: { error: 'boom' }, perf: { ok: false, reason: 'q' } };
  ok(toMarkdownSuite(s, { lang: 'en' }).includes('Not available:'), 'i18n: suite markdown in inglese');
  ok(toHtmlSuite(s, { lang: 'en' }).includes('<html lang="en">'), 'i18n: suite html con lang corretto');
}

// accessibleFormLabels — controlli con/senza etichetta accessibile
{
  const withLabel = '<form><label for="e">Email</label><input id="e" type="text"></form>';
  ok(accessibleFormLabels(withLabel).total === 1 && accessibleFormLabels(withLabel).labeled === 1, 'form: input con label for → labeled');
  const noLabel = '<form><input type="text" name="q"></form>';
  ok(accessibleFormLabels(noLabel).total === 1 && accessibleFormLabels(noLabel).labeled === 0, 'form: input senza label → non labeled');
  const hidden = '<form><input type="hidden" name="tok"><input type="submit"></form>';
  ok(accessibleFormLabels(hidden).total === 0, 'form: hidden/submit non richiedono label');
  const aria = '<textarea aria-label="Messaggio"></textarea>';
  ok(accessibleFormLabels(aria).labeled === 1, 'form: aria-label conta come etichetta');
  // label IMPLICITA: pattern standard del checkbox consenso (input dentro <label>)
  const implicit = '<label><input type="checkbox" name="ok" required><span>Acconsento al trattamento</span></label>';
  ok(accessibleFormLabels(implicit).total === 1 && accessibleFormLabels(implicit).labeled === 1, 'form: label implicita (input dentro label) → labeled');
  const emptyLabel = '<label><input type="checkbox" name="ok"></label>';
  ok(accessibleFormLabels(emptyLabel).labeled === 0, 'form: label senza testo non etichetta');
  // honeypot antispam: fuori dalla accessibility tree, non va conteggiato
  const honeypot = '<form><input type="email" aria-label="Email"><div aria-hidden="true"><input type="text" name="hp_website"></div></form>';
  const hp = accessibleFormLabels(honeypot);
  ok(hp.total === 1 && hp.labeled === 1, 'form: campo in sottoalbero aria-hidden escluso (honeypot)');
  // regressione: l'esclusione vale solo DENTRO il sottoalbero, non dopo la sua chiusura
  const afterHidden = '<div aria-hidden="true"><span>x</span></div><input type="text" name="q">';
  ok(accessibleFormLabels(afterHidden).total === 1, 'form: campo dopo la chiusura di aria-hidden resta contato');
}

// anti-SSRF — blocca risorse interne, passa IP pubblici (solo IP: niente DNS/rete nei test)
{
  ok(isBlockedIp('127.0.0.1') && isBlockedIp('169.254.169.254') && isBlockedIp('10.0.0.1') && isBlockedIp('192.168.1.1'), 'ssrf: IP interni bloccati');
  ok(!isBlockedIp('8.8.8.8') && !isBlockedIp('1.1.1.1'), 'ssrf: IP pubblici ammessi');
  ok(isBlockedIp('::1') && isBlockedIp('fd00::1'), 'ssrf: loopback/ULA IPv6 bloccati');
  let blocked = false;
  try { await assertSafeUrl('http://127.0.0.1/'); } catch { blocked = true; }
  ok(blocked, 'ssrf: assertSafeUrl blocca 127.0.0.1');
  let schemeBlocked = false;
  try { await assertSafeUrl('file:///etc/passwd'); } catch { schemeBlocked = true; }
  ok(schemeBlocked, 'ssrf: assertSafeUrl blocca schema file://');
  ok((await assertSafeUrl('http://1.1.1.1/')).hostname === '1.1.1.1', 'ssrf: assertSafeUrl passa IP pubblico');
}

// ── AI Act: rilevamento segnali (funzioni pure, nessuna rete) ───────────────
{
  const bot = '<html><body><script src="https://widget.intercom.io/widget/abc"></script><p>Ciao</p></body></html>';
  const s1 = detectAiSignals(bot, { url: 'https://x.ch/' });
  ok(s1.chatbots.includes('Intercom'), 'aiact: vendor chatbot riconosciuto');
  ok(s1.botDisclosure === false, 'aiact: nessuna disclosure nel testo visibile');
  const a1 = analyzeAiAct(s1);
  ok(a1.checks[0].status === 'crit', 'aiact: chatbot senza disclosure = critico (art. 50 §1)');
  ok(a1.informational === true, 'aiact: categoria informativa, non pesa sullo score GEO');

  // La disclosure conta solo se è TESTO VISIBILE: una classe "ai-chat" non è comunicazione.
  const attrOnly = '<html><body><div class="ai-assistant-widget"></div></body></html>';
  ok(detectAiSignals(attrOnly).botDisclosure === false, 'aiact: attributo non vale come disclosure');
  const disclosed = bot.replace('<p>Ciao</p>', '<p>Stai parlando con un assistente virtuale automatico.</p>');
  ok(analyzeAiAct(detectAiSignals(disclosed)).checks[0].status === 'good', 'aiact: disclosure nel testo = ok');
  // Il testo dentro <script> non è visibile all'utente → non deve valere come disclosure.
  const inScript = '<html><body><script>var x="assistente virtuale";</script><div class="chat-widget"></div></body></html>';
  ok(detectAiSignals(inScript).botDisclosure === false, 'aiact: testo dentro <script> escluso');

  const emo = '<script src="/js/face-api.min.js"></script>';
  ok(analyzeAiAct(detectAiSignals(emo)).checks[1].status === 'crit', 'aiact: riconoscimento emozioni = critico (art. 5)');
  ok(analyzeAiAct(detectAiSignals('<p>ciao</p>')).checks[1].status === 'good', 'aiact: nessuna biometria = ok');

  // La marcatura dei contenuti resta 'info': dall'HTML non si sa se il contenuto è generato.
  ok(analyzeAiAct(detectAiSignals('<p>x</p>')).checks[2].status === 'info', 'aiact: provenienza sempre informativa');

  const eu = detectAiSignals('<link rel="alternate" hreflang="de" href="/de"><p>Prezzo 20 €</p>', { url: 'https://x.ch/' });
  ok(eu.euSignals.includes('hreflang UE') && eu.euSignals.includes('prezzi in euro'), 'aiact: segnali di mercato UE');
}

// ── AI Act: obblighi derivati ───────────────────────────────────────────────
{
  const ids = (o) => o.map((x) => x.id);
  const deployer = deriveObligations({ role: 'deployer', interaction: true, euMarket: 'yes' });
  ok(ids(deployer).includes('art50_1') && ids(deployer).includes('art4'), 'aiact: deployer con chatbot → art. 50 §1 + art. 4');
  ok(!ids(deployer).includes('art50_2'), 'aiact: art. 50 §2 solo per il fornitore');
  ok(ids(deriveObligations({ role: 'provider', syntheticContent: true })).includes('art50_2'), 'aiact: fornitore generativo → art. 50 §2');

  // Responsabilità editoriale umana = esenzione dell'art. 50 §4 c. 2 (pipeline blog con review).
  ok(ids(deriveObligations({ role: 'deployer', syntheticContent: true, editorialReview: false })).includes('art50_4_text'), 'aiact: testi IA senza review → obbligo');
  ok(!ids(deriveObligations({ role: 'deployer', syntheticContent: true, editorialReview: true })).includes('art50_4_text'), 'aiact: review editoriale = esente');

  // Lo scan attiva un obbligo che l'utente non ha dichiarato.
  const fromScan = deriveObligations({ role: 'none' }, { chatbots: ['Tidio'] });
  ok(ids(fromScan).includes('art50_1'), 'aiact: chatbot trovato dallo scan attiva l’obbligo');

  const hr = deriveObligations({ role: 'deployer', highRiskUse: ['hr'] });
  ok(ids(hr).includes('highRiskDeployer') && !ids(hr).includes('highRiskProvider'), 'aiact: alto rischio → obblighi da utilizzatore');
  ok(deriveObligations({ role: 'deployer', prohibitedUse: ['socialScoring'] }).some((o) => o.severity === 'blocking'), 'aiact: pratica vietata = blocking');
  ok(deriveObligations({ role: 'none' }).length === 0, 'aiact: nessuna IA, nessun segnale → nessun obbligo');
  // Le date rinviate dal Digital Omnibus non devono tornare al 2026 per sbaglio.
  ok(hr.find((o) => o.id === 'highRiskDeployer').from === '2027-12-02', 'aiact: alto rischio rinviato al 02.12.2027');
  ok(OBLIGATIONS.art50_1.from === '2026-08-02', 'aiact: trasparenza applicabile dal 02.08.2026');
}

// ── AI Act: verdetto di ambito ──────────────────────────────────────────────
{
  const v = (a, s) => decideVerdict(a, s, deriveObligations(a, s));

  ok(v({ role: 'deployer', euMarket: 'yes' }).scope === 'in', 'aiact: IA + mercato UE dichiarato = dentro');
  ok(v({ role: 'deployer', euMarket: 'yes' }).confidence === 'high', 'aiact: dichiarazione esplicita = alta confidenza');
  ok(v({ role: 'none' }, { chatbots: [], emotion: [], euSignals: [] }).scope === 'out', 'aiact: nessuna IA = fuori');

  // Asse materiale: senza IA il territorio è irrilevante.
  ok(v({ role: 'none', euMarket: 'yes' }, { chatbots: [], emotion: [], euSignals: ['hreflang UE'] }).scope === 'out', 'aiact: mercato UE senza IA resta fuori');

  // Tensione 1: l'utente dice "no UE" ma i segnali forti dicono il contrario.
  const contradictEu = v({ role: 'deployer', euMarket: 'no' }, { chatbots: ['Crisp'], euSignals: ['hreflang UE', 'prezzi in euro'] });
  ok(contradictEu.scope === 'likely', 'aiact: segnali UE forti contro un "no" → likely, non sovrascritto');
  ok(contradictEu.reasons.some((r) => r.key === 'euContradiction'), 'aiact: la contraddizione UE è motivata all’utente');
  // Segnali deboli non bastano a contraddire: un sito .ch che cita un dominio .it resta fuori ambito probabile.
  ok(v({ role: 'deployer', euMarket: 'no' }, { chatbots: [], euSignals: ['dominio o riferimento UE', 'cookie banner GDPR'] }).scope === 'unlikely', 'aiact: segnali UE deboli non ribaltano il "no"');
  ok(v({ role: 'deployer', euMarket: 'no' }, { chatbots: [], euSignals: [] }).scope === 'out', 'aiact: nessun nesso UE = fuori');

  // Tensione 2: "nessuna IA" ma la pagina ha un chatbot → lo scan prova l'esistenza.
  const contradictAi = v({ role: 'none', euMarket: 'yes' }, { chatbots: ['Tidio'], euSignals: [] });
  ok(contradictAi.material === 'likely' && contradictAi.headline === 'contradiction', 'aiact: chatbot in pagina smentisce "nessuna IA"');
  ok(contradictAi.confidence === 'low', 'aiact: contraddizione = confidenza bassa');

  // Tensione 3: 'unsure' ha un livello proprio, e sale a 'in' se la pagina lo conferma.
  ok(v({ role: 'deployer', euMarket: 'unsure' }, { chatbots: [], euSignals: [] }).scope === 'likely', 'aiact: "non lo so" = likely');
  ok(v({ role: 'deployer', euMarket: 'unsure' }, { chatbots: [], euSignals: ['hreflang UE'] }).scope === 'in', 'aiact: "non lo so" + segnale forte = dentro');

  // Le pratiche vietate scavalcano l'ambito: problema anche per un sito solo svizzero.
  const banned = v({ role: 'deployer', euMarket: 'no', prohibitedUse: ['emotionWorkplace'] }, { chatbots: [], euSignals: [] });
  ok(banned.blocking === true && banned.headline === 'blocking', 'aiact: pratica vietata scavalca il verdetto di ambito');

  // Senza scan la valutazione funziona comunque (solo questionario).
  const noScan = v({ role: 'deployer', euMarket: 'yes' }, null);
  ok(noScan.scope === 'in' && noScan.scanned === false, 'aiact: verdetto valido anche senza scansione');
  ok(euEvidence(null) === 0, 'aiact: euEvidence tollera signals null');
}

// ── AI Act: assemblaggio + i18n ─────────────────────────────────────────────
{
  const r = assessAiAct({ role: 'deployer', interaction: true, euMarket: 'yes', highRiskUse: ['hr'] }, null, 'it');
  ok(r.verdict.title.length > 10 && !/^aiact\./.test(r.verdict.title), 'aiact: titolo del verdetto tradotto');
  ok(r.obligations.every((o) => o.label && !/^aiact\.ob\./.test(o.label)), 'aiact: obblighi con etichetta tradotta');
  ok(r.obligations[0].severity !== 'future', 'aiact: obblighi ordinati per urgenza');
  ok(!r.due.includes('highRiskDeployer'), 'aiact: le scadenze future non stanno tra gli obblighi già dovuti');
  ok(/non attesta la conformità/i.test(r.disclaimer), 'aiact: il disclaimer nega esplicitamente l’attestazione di conformità');
  const en = assessAiAct({ role: 'deployer', euMarket: 'yes' }, null, 'en');
  ok(/scope of the AI Act/i.test(en.verdict.title), 'aiact: inglese tradotto');
  // de/fr/es/pt non tradotti: fallback per-chiave sull'italiano, non la chiave grezza.
  const de = assessAiAct({ role: 'deployer', euMarket: 'yes' }, null, 'de');
  ok(!/^aiact\./.test(de.verdict.title), 'aiact: lingue non tradotte ricadono sull’italiano');
}

// ── AI Act: falsi positivi trovati su siti reali (regressione) ──────────────
// Entrambi rilevati provando la CLI su intercom.com: il primo etichettava un link
// marketing come plugin WordPress, il secondo leggeva le classi Tailwind come domini UE.
{
  const s1 = detectAiSignals('<html><body><a href="https://fin.ai/ai-engine">AI Engine</a></body></html>');
  ok(!s1.chatbots.includes('AI Engine (WP)'), 'aiact: un link "ai-engine" non è il plugin AI Engine');
  const s2 = detectAiSignals('<html><head><script src="/wp-content/plugins/ai-engine/app/chatbot.js"></script></head><body>x</body></html>');
  ok(s2.chatbots.includes('AI Engine (WP)'), 'aiact: il plugin AI Engine vero viene rilevato');

  const tw = detectAiSignals('<html><head><style>.pl-1{padding-left:4px}.pt-0{padding-top:0}.at-x{top:0}</style></head><body>x</body></html>');
  ok(!tw.euSignals.includes('dominio o riferimento UE'), 'aiact: le classi CSS Tailwind non sono domini UE');
  const eu = detectAiSignals('<html><body><a href="https://esempio.it/contatti">Contatti</a></body></html>');
  ok(eu.euSignals.includes('dominio o riferimento UE'), 'aiact: un dominio .it in un URL è un segnale UE');

  // Pagina muta: un solo controllo valutabile → nessun punteggio, non 100/100.
  const mute = analyzeAiAct(detectAiSignals('<html><body><p>Ciao</p></body></html>'), 'it');
  ok(mute.score === null, 'aiact: niente punteggio quando non c’è nulla da valutare');
  const withBot = analyzeAiAct(detectAiSignals('<html><body><script src="https://embed.tawk.to/x/default"></script><p>Assistente virtuale</p></body></html>'), 'it');
  ok(typeof withBot.score === 'number', 'aiact: con un chatbot il punteggio esiste');

  const docs = detectAiSignals('<html><body><p>Documentiamo api.openai.com nel nostro blog.</p></body></html>');
  ok(!docs.chatbots.includes('OpenAI diretto'), 'aiact: menzionare api.openai.com non è usarlo');
  const call = detectAiSignals('<html><script>fetch("https://api.openai.com/v1/chat/completions")</script><body>x</body></html>');
  ok(call.chatbots.includes('OpenAI diretto'), 'aiact: la chiamata reale a /v1 viene rilevata');
}

// ── AI Act: la UI copre il questionario del motore (guardia anti-deriva) ─────
// Il testo delle domande vive nel web (web/app/aiact/questions.js) perché la
// chiave i18n è la stringa italiana; il motore possiede gli id e i tipi. Se i due
// divergono, a schermo compaiono id nudi o opzioni che il motore ignora: qui rompe.
{
  const uiIds = Object.keys(QUESTION_TEXT);
  ok(uiIds.length === QUESTIONS.length, 'aiact/ui: stesso numero di domande nel motore e nella UI');
  for (const q of QUESTIONS) {
    const ui = QUESTION_TEXT[q.id];
    ok(!!ui, `aiact/ui: testo presente per la domanda ${q.id}`);
    ok(ui.kind === q.kind, `aiact/ui: tipo coerente per ${q.id}`);
    if (q.options) {
      const uiOpts = Object.keys(ui.options || {});
      ok(uiOpts.length === q.options.length && q.options.every((o) => ui.options[o]),
        `aiact/ui: tutte le opzioni etichettate per ${q.id}`);
    } else {
      ok(!ui.options, `aiact/ui: nessuna opzione spuria su ${q.id} (bool)`);
    }
  }
  ok(REQUIRED.every((id) => QUESTION_TEXT[id]), 'aiact/ui: le domande obbligatorie esistono');
  ok(Object.values(QUESTION_TEXT).every((q) => !q.showIf || QUESTION_TEXT[q.showIf]),
    'aiact/ui: ogni showIf punta a una domanda esistente');
  // Le dipendenze vivono in due posti: SHOW_IF (motore, usato da `coverage`) e
  // `showIf` (UI, decide cosa mostrare). Se divergono, una domanda nascosta viene
  // contata come "non risposta" — o viceversa una mostrata sparisce dal conteggio.
  const uiShowIf = Object.fromEntries(
    Object.entries(QUESTION_TEXT).filter(([, q]) => q.showIf).map(([id, q]) => [id, q.showIf]));
  ok(JSON.stringify(uiShowIf) === JSON.stringify(SHOW_IF),
    `aiact/ui: SHOW_IF del motore == showIf della UI (${JSON.stringify(uiShowIf)})`);
  // Ogni domanda deve avere la spiegazione estesa e almeno due esempi: chi legge
  // "sei fornitore o deployer?" senza esempi tira a indovinare, e una risposta
  // indovinata produce un verdetto sbagliato con l'aria di essere autorevole.
  for (const [id, q] of Object.entries(QUESTION_TEXT)) {
    ok(typeof q.detail === 'string' && q.detail.length > 80, `aiact/ui: spiegazione estesa su ${id}`);
    ok(Array.isArray(q.examples) && q.examples.length >= 2, `aiact/ui: almeno due esempi su ${id}`);
    ok(q.examples.every((e) => typeof e === 'string' && e.trim().length > 0), `aiact/ui: nessun esempio vuoto su ${id}`);
  }
  // La chiave i18n È la stringa italiana: una stringa senza voce in `en` resta
  // in italiano sul sito inglese, e nessun errore lo segnala a runtime.
  const missingEn = Object.values(QUESTION_TEXT)
    .flatMap((q) => [q.q, q.help, q.detail, ...(q.examples || []), ...Object.values(q.options || {})])
    .filter((s) => s && !en[s]);
  ok(missingEn.length === 0, `aiact/ui: traduzione en per ogni stringa del questionario (mancanti: ${missingEn.slice(0, 3).join(' | ')})`);
  // Il verdetto deve essere calcolabile con le sole risposte obbligatorie.
  const minimal = assessAiAct(Object.fromEntries(REQUIRED.map((id) => [id, id === 'role' ? 'deployer' : 'yes'])), null, 'it');
  ok(minimal.verdict.title && minimal.obligations.length > 0, 'aiact/ui: le risposte obbligatorie bastano per un verdetto');
}

// ── AI Act: copertura delle risposte ─────────────────────────────────────────
// Il motore legge una domanda senza risposta come un "no". È prudente, ma un
// referto che tace la differenza tra "ho detto no" e "non ho risposto" promette
// una completezza che non ha: `coverage` la misura e il verdetto la dichiara.
{
  const full = {
    euMarket: 'yes', role: 'deployer', interaction: true, syntheticContent: true,
    editorialReview: false, deepfake: false, gpai: false, staffUsingAi: true,
    highRiskUse: ['none'], prohibitedUse: ['none'],
  };
  const c = coverage(full);
  ok(c.missing.length === 0 && c.answered === c.applicable && c.applicable === QUESTIONS.length,
    `aiact/coverage: questionario completo = 0 mancanti (${JSON.stringify(c)})`);

  // `false` è una risposta, non un vuoto: senza questo un questionario tutto "no"
  // risulterebbe non compilato e la confidenza scenderebbe senza motivo.
  const allNo = { ...full, interaction: false, syntheticContent: false, staffUsingAi: false };
  const cNo = coverage(allNo);
  ok(cNo.missing.length === 0, `aiact/coverage: i "no" contano come risposte (${JSON.stringify(cNo.missing)})`);
  // ...e le due domande dipendenti da syntheticContent escono dal denominatore.
  ok(cNo.applicable === QUESTIONS.length - 2,
    `aiact/coverage: le domande nascoste non entrano nel conteggio (${cNo.applicable})`);

  // Elenco vuoto su una multipla = domanda saltata; ['none'] = "nessuna di queste".
  ok(coverage({ ...full, highRiskUse: [] }).missing.join() === 'highRiskUse',
    'aiact/coverage: multipla vuota = non risposta');
  ok(coverage({ ...full, highRiskUse: ['none'] }).missing.length === 0,
    'aiact/coverage: «nessuna di queste» = risposta');
  // Un valore fuori elenco (querystring manipolata, vecchio link) non è una risposta.
  ok(coverage({ ...full, role: 'boss' }).missing.join() === 'role',
    'aiact/coverage: valore non previsto = non risposta');

  // Copertura parziale: confidenza al massimo 'media' e motivo scritto nel referto.
  const part = assessAiAct({ euMarket: 'yes', role: 'provider' }, null, 'it');
  ok(part.verdict.confidence === 'medium', `aiact/coverage: confidenza declassata (${part.verdict.confidence})`);
  ok(part.verdict.reasons.some((r) => /in parte/.test(r)), 'aiact/coverage: il referto dichiara la copertura parziale');
  ok(part.coverage.answered === 2 && part.coverage.missing.length > 0, 'aiact/coverage: il conteggio arriva alla UI');
  ok(assessAiAct(full, null, 'it').verdict.confidence === 'high',
    'aiact/coverage: questionario completo = confidenza alta');
  // Un divieto dichiarato è certo comunque: le domande saltate non lo rendono dubbio.
  const banned = assessAiAct({ euMarket: 'yes', role: 'deployer', prohibitedUse: ['emotionWorkplace'] }, null, 'it');
  ok(banned.verdict.confidence === 'high' && banned.verdict.blocking,
    `aiact/coverage: un divieto resta certo con copertura parziale (${banned.verdict.confidence})`);
}

// ── AI Act: contraddizione e obblighi fuori ambito ──────────────────────────
// Caso reale (tidio.com): l'utente dichiara "nessuna IA, solo Svizzera" ma la
// pagina monta un chatbot. Il titolo non deve confermare la risposta sbagliata,
// e l'obbligo dell'art. 50 §1 non deve comparire come già esigibile.
{
  const answers = { role: 'none', euMarket: 'no' };
  const signals = { chatbots: ['Tidio'], emotion: [], euSignals: [] };
  const a = assessAiAct(answers, signals, 'it');
  ok(a.verdict.scope === 'out', 'aiact/out: senza nesso UE l’ambito resta fuori');
  ok(a.verdict.headline === 'contradiction', 'aiact/out: la contraddizione vince sul titolo "fuori"');
  const art50 = a.obligations.find((o) => o.id === 'art50_1');
  ok(art50 && art50.severity === 'conditional', 'aiact/out: art. 50 §1 marcato condizionale, non esigibile');
  ok(!a.due.includes('art50_1'), 'aiact/out: gli obblighi condizionali non entrano in `due`');

  // Nessuna contraddizione, nessun segnale: verdetto pulito "fuori".
  const clean = assessAiAct(answers, { chatbots: [], emotion: [], euSignals: [] }, 'it');
  ok(clean.verdict.headline === 'out', 'aiact/out: senza segnali il titolo è "fuori"');

  // La nLPD non si annacqua mai: vale in Svizzera indipendentemente dall'AI Act.
  const withData = assessAiAct({ ...answers, staffUsingAi: true }, null, 'it');
  const nldp = withData.obligations.find((o) => o.id === 'nldp');
  if (nldp) ok(nldp.severity === 'due', 'aiact/out: la nLPD resta esigibile anche fuori ambito');

  // Una pratica vietata resta bloccante anche fuori dall'Unione.
  const banned = assessAiAct({ ...answers, prohibitedUse: ['socialScoring'] }, null, 'it');
  ok(banned.verdict.headline === 'blocking', 'aiact/out: la pratica vietata scavalca il "fuori"');
  ok(banned.obligations.find((o) => o.id === 'art5').severity === 'blocking', 'aiact/out: art. 5 resta bloccante');
}

// ── AI Act: il tempo che passa sopra le date dell'art. 113 ──────────────────
// `from` è un dato statico, `inForce` è un giudizio: senza una data di riferimento
// iniettabile il motore direbbe "dal 2026-08-02" a chi ha già l'obbligo addosso, e
// terrebbe l'alto rischio marcato "futuro" anche nel 2028.
{
  const answers = { euMarket: 'yes', role: 'provider', interaction: true, staffUsingAi: true, highRiskUse: ['credit'] };
  const find = (a, id) => a.obligations.find((o) => o.id === id);

  // Vigilia della trasparenza: l'art. 4 è già in forza, l'art. 50 §1 non ancora.
  const eve = assessAiAct(answers, null, 'it', '2026-08-01');
  ok(find(eve, 'art4').inForce === true, 'aiact/date: art. 4 in forza già nel 2026');
  ok(find(eve, 'art50_1').inForce === false, 'aiact/date: il 01.08.2026 l’art. 50 §1 non è ancora in forza');
  ok(find(eve, 'highRiskProvider').severity === 'future', 'aiact/date: alto rischio ancora futuro nel 2026');

  // Giorno dell'applicabilità: il confine è incluso, non "dal giorno dopo".
  const day = assessAiAct(answers, null, 'it', '2026-08-02');
  ok(find(day, 'art50_1').inForce === true, 'aiact/date: il 02.08.2026 l’art. 50 §1 è in forza');

  // Dopo il rinvio del Digital Omnibus: l'alto rischio matura in obbligo esigibile.
  const later = assessAiAct(answers, null, 'it', '2027-12-02');
  ok(find(later, 'highRiskProvider').severity === 'due', 'aiact/date: dal 02.12.2027 l’alto rischio è esigibile');
  ok(later.due.includes('highRiskProvider'), 'aiact/date: maturato, entra in `due`');

  // La nLPD non ha data: è in forza a qualunque data di riferimento.
  ok(find(later, 'nldp').inForce === true && find(eve, 'nldp').inForce === true, 'aiact/date: la nLPD è senza scadenza');

  // Fuori ambito, un obbligo maturato resta condizionale: la maturazione riguarda
  // il tempo, non il perimetro — e le due cose non devono annullarsi a vicenda.
  const outLater = assessAiAct({ euMarket: 'no', role: 'provider', highRiskUse: ['credit'] }, null, 'it', '2027-12-02');
  ok(find(outLater, 'highRiskProvider').severity === 'conditional', 'aiact/date: fuori ambito il maturato è condizionale');
}

// ── Robustezza sugli input malformati (trovati con un fuzz delle route) ──────
// Le route accettano un body JSON: chiunque può mandare un numero dove serve una
// stringa. Prima questi casi uscivano come 500 «TypeError: ...» — un errore del
// server per un errore dell'utente. Qui si verifica il livello sotto: le funzioni
// pure devono distinguere «input sbagliato» (dichiarato) da «guasto» (eccezione).
{
  // normUrl accetta l'indirizzo digitato senza schema, come fa la UI.
  ok(normUrl('esempio.ch') === 'https://esempio.ch/', 'normUrl: aggiunge lo schema mancante');
  ok(normUrl('  http://esempio.ch/x  ') === 'http://esempio.ch/x', 'normUrl: tollera gli spazi ai lati');
  ok(normUrl('HTTP://Esempio.CH/') === 'http://esempio.ch/', 'normUrl: normalizza schema e host');
  // ...e rifiuta il resto con un errore marcato, che le route traducono in 400.
  const rejects = ['', '   ', 'not a url', 'javascript:alert(1)', 'data:text/html,x', ' ', null, undefined, 42, {}, []];
  for (const bad of rejects) {
    let e = null;
    try { normUrl(bad); } catch (err) { e = err; }
    ok(e && e.badUrl === true, `normUrl: rifiuta ${JSON.stringify(bad)} con badUrl`);
    ok(e && typeof e.message === 'string' && !/TypeError|Invalid URL/.test(e.message),
      `normUrl: messaggio leggibile per ${JSON.stringify(bad)}`);
  }
  // Un host con la porta NON è uno schema: il riconoscimento dello schema deve
  // vedere il punto in `esempio.ch:8080` e lasciar passare l'indirizzo.
  ok(normUrl('esempio.ch:8080/x') === 'https://esempio.ch:8080/x', 'normUrl: host con porta senza schema');
  ok(normUrl('http://esempio.ch:8080') === 'http://esempio.ch:8080/', 'normUrl: host con porta e schema');
  for (const s of ['ftp://esempio.ch/', 'file:///etc/passwd', 'gopher://esempio.ch/']) {
    let msg = '';
    try { normUrl(s); } catch (e) { msg = e.message; }
    ok(/solo indirizzi http e https/.test(msg), `normUrl: messaggio sullo schema per ${s} (${msg})`);
  }

  // `javascript:` e `data:` non devono passare nemmeno per un'altra strada: se il
  // fetch partisse, il guard SSRF li fermerebbe, ma non devono arrivare fin lì.
  for (const scheme of ['javascript:alert(1)', 'data:text/html,<h1>x</h1>', 'file:///etc/passwd', 'ftp://esempio.ch/']) {
    let ok4 = false;
    try { const u = normUrl(scheme); ok4 = u.startsWith('http://') || u.startsWith('https://'); } catch { ok4 = true; }
    ok(ok4, `normUrl: nessuno schema esotico sopravvive (${scheme})`);
  }

  // Un elenco a scelta multipla con il tipo sbagliato vale come nessuna selezione:
  // il questionario non inventa obblighi e non lancia.
  for (const junk of ['hr', 42, true, {}, null, [42], [{}]]) {
    const a = { euMarket: 'yes', role: 'provider', highRiskUse: junk, prohibitedUse: junk };
    let r = null;
    try { r = assessAiAct(a, null, 'it'); } catch { r = null; }
    ok(r && r.verdict && Array.isArray(r.obligations),
      `aiact/robustezza: multi = ${JSON.stringify(junk)} non lancia`);
    ok(r && !r.obligations.some((o) => o.id === 'highRiskProvider' || o.id === 'prohibited'),
      `aiact/robustezza: multi = ${JSON.stringify(junk)} non attiva alto rischio né divieti`);
  }
  // Le voci valide dentro un elenco sporco restano valide: filtriamo il tipo, non il senso.
  const mixed = assessAiAct({ euMarket: 'yes', role: 'deployer', highRiskUse: ['hr', 42, null, {}] }, null, 'it');
  ok(mixed.obligations.some((o) => o.id === 'highRiskDeployer'),
    'aiact/robustezza: le voci valide in un elenco misto contano');
}

// ── Il blocco anti-SSRF non si riprova ───────────────────────────────────────
// Senza questo, `fetchText` rifaceva 3 volte la stessa richiesta bloccata con
// backoff: su una scansione con molte sotto-richieste l'audit sfiorava i 20s.
{
  const t0 = Date.now();
  const r = await fetchText('http://127.0.0.1:1/', { timeout: 15000 });
  const ms = Date.now() - t0;
  ok(r.ok === false, 'ssrf/retry: l\'IP interno resta bloccato');
  ok(/SsrfError|interno/.test(r.error), `ssrf/retry: l'errore dice che è un blocco (${r.error.slice(0, 60)})`);
  ok(ms < 1000, `ssrf/retry: nessun backoff sul blocco (${ms}ms, prima ≥1800)`);
  // `blocked` è ciò che distingue «indirizzo rifiutato» (400: dipende da ciò che
  // è stato scritto) da «sito che non risponde» (502): senza il flag la route
  // non può scegliere, e ha risposto 200 «nessun segnale» a un file:// bloccato.
  ok(r.blocked === true, 'ssrf/retry: il blocco è marcato `blocked` per chi chiama');
  // Un nome che non risolve rientra nello stesso caso: è l'indirizzo a essere
  // sbagliato, non il sito a essere giù → 400, non 502. Il caso opposto (host
  // pubblico che risolve ma non risponde) dipende dalla rete: verificato dal
  // vivo, non qui, perché in CI senza DNS diventerebbe un test che mente.
  const dns = await fetchText('http://esempio-che-non-esiste-mai.invalid/', { timeout: 4000, retries: 0 });
  ok(dns.ok === false && dns.blocked === true, 'ssrf/retry: nome irrisolvibile = colpa dell\'indirizzo');
}

// ── AI Act: invarianti su TUTTE le combinazioni di risposte ──────────────────
// Gli assert sopra scelgono i casi a mano: coprono i rami che conosciamo. Questo
// blocco genera il prodotto cartesiano delle risposte (comprese le domande non
// risposte) su due date e due esiti di scansione, e verifica ciò che deve valere
// sempre. È il check che ha trovato il `future` sopravvissuto al fuori-ambito.
{
  const DOM = {
    euMarket: ['yes', 'no', 'unsure', undefined],
    role: ['none', 'deployer', 'provider', 'both', undefined],
    interaction: [true, false, undefined],
    syntheticContent: [true, false, undefined],
    editorialReview: [true, false, undefined],
    deepfake: [true, false, undefined],
    gpai: [true, false, undefined],
    staffUsingAi: [true, false, undefined],
    highRiskUse: [['none'], ['hr'], undefined],
    prohibitedUse: [['none'], ['emotionWorkplace'], undefined],
  };
  const SIGNALS = [null, { chatbot: { found: true }, provenance: { found: false }, emotion: { found: true }, euOffer: { found: true } }];
  const DATES = ['2026-08-03', '2027-12-02'];
  const SCOPES = ['in', 'out', 'partial', 'unsure', 'likely', 'unlikely'];
  const ids = QUESTIONS.map((q) => q.id);
  const bad = new Map();
  const note = (rule, ctx) => { if (!bad.has(rule)) bad.set(rule, JSON.stringify(ctx).slice(0, 240)); };
  let cases = 0;

  const check = (a) => {
    for (const signals of SIGNALS) for (const today of DATES) {
      cases++;
      let r;
      try { r = assessAiAct(a, signals, 'it', today); } catch (e) { note('lancia: ' + e.message, { a, today }); continue; }
      const v = r.verdict, ctx = { a, today, scanned: !!signals };
      if (!SCOPES.includes(v.scope)) note('scope fuori elenco: ' + v.scope, ctx);
      if (!['low', 'medium', 'high'].includes(v.confidence)) note('confidence fuori elenco: ' + v.confidence, ctx);
      if (v.reasons.some((x) => typeof x !== 'string' || !x.trim())) note('reason vuota o non stringa', ctx);
      // Una chiave i18n a schermo è un messaggio mancante, non un testo.
      if (v.reasons.some((x) => x.startsWith('aiact.'))) note('chiave i18n non tradotta', { ...ctx, r: v.reasons });

      const banned = Array.isArray(a.prohibitedUse) && a.prohibitedUse.some((x) => x !== 'none');
      if (banned && !(v.blocking && v.confidence === 'high' && v.headline === 'blocking')) note('divieto dichiarato non bloccante', ctx);

      // Fuori ambito nessun obbligo dell'AI Act è esigibile: né 'due' né 'future'.
      // La nLPD è l'eccezione dichiarata — vale in Svizzera comunque.
      if (v.scope === 'out' && !v.blocking) {
        const hard = r.obligations.filter((o) => o.severity !== 'conditional' && o.id !== 'nldp');
        if (hard.length) note('fuori ambito con obblighi esigibili: ' + hard.map((o) => o.id + '/' + o.severity).join(','), ctx);
      }
      for (const o of r.obligations) {
        if (!o.ref || !o.label || !o.why) note('obbligo senza riferimento o testo: ' + o.id, ctx);
        if (o.from !== 'in vigore' && !/^\d{4}-\d{2}-\d{2}$/.test(o.from)) note('data non ISO: ' + o.id + ' = ' + o.from, ctx);
        else if (o.id !== 'nldp' && o.inForce !== (o.from <= today)) note('inForce incoerente: ' + o.id, ctx);
      }
      const c = r.coverage;
      if (c.answered > c.applicable || c.applicable > QUESTIONS.length) note('copertura incoerente', { ...ctx, c });
      if (c.missing.length && v.confidence === 'high' && !v.blocking) note('confidence alta con copertura parziale', { ...ctx, c });
    }
  };
  (function rec(i, a) {
    if (i === ids.length) return check(a);
    for (const val of DOM[ids[i]]) rec(i + 1, val === undefined ? a : { ...a, [ids[i]]: val });
  })(0, {});

  ok(cases > 500000, `aiact/invarianti: combinazioni generate (${cases})`);
  ok(bad.size === 0, `aiact/invarianti: nessuna violazione — ${[...bad].map(([k, c]) => k + ' ' + c).join(' || ')}`);
}

console.log(`\x1b[32m✓ ${n} assert passati\x1b[0m`);

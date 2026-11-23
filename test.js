// test.js — check runnabile sulle funzioni pure (assert, niente framework).
// node test.js  →  esce !=0 se qualcosa si rompe.
import assert from 'node:assert/strict';
import { AI_CRAWLERS, LIVE_UA, TRAINING_CRAWLERS, RETRIEVAL_CRAWLERS, parseRobots, getTitle, getMeta, jsonLdTypes, jsonLdCount, contentHtml, semanticRatio, wordCount, imgAlt, headings, links, normUrl, fetchText, stripTags, bodyHtml, headFlags, htmlLang, sections, extractableBlocks, paragraphWords, citableEvidence, contentWords, traceRedirects } from './src/lib.js';
import { analyzeStructured, analyzeReadability, analyzeAccess, analyzeAgentFiles, analyzeOffsite, analyzeRights, analyzeTech, analyzeAnswerability, analyzeAgentReady, parseContentUsage, detectWebmcp, isQuestionHeading, pageLang, CATEGORY_LABELS } from './src/analyzers.js';
import { analyzeA11y, summarizeAxe, accessibleFormLabels } from './src/a11y.js';
import { assertSafeUrl, isBlockedIp, SsrfError, makeSafeLookup, pinnedFetch, safeFetch, __setResolverForTests } from './src/ssrf-guard.js';
import http from 'node:http';
import zlib from 'node:zlib';
import { summarizePsi } from './src/perf.js';
import { generateStatement } from './src/statement.js';
import { remedyFor, REMEDIATION } from './src/remediation.js';
import { toHtmlSuite, toMarkdownSuite } from './src/suiteReport.js';
import { auditAll } from './src/suite.js';
import { snapshot, diff } from './src/history.js';
import { rateLimit, verifyTurnstile } from './src/guard.js';
import { renderHtml } from './src/render.js';
import { pagesFromSitemap, pagesFromLinks, aggregate } from './crawl.js';
import { normalize, toMarkdown, toHtml } from './src/report.js';
import { auditHtmlSnapshot } from './audit.js';
import WEIGHTS, { PROFILE } from './weights.mjs';
import { deriveBrand, groupBySection, generateLlmsTxt, significantLinks, linkLabel } from './src/llmstxt.js';
import { detectAiSignals, analyzeAiAct } from './src/aiact.js';
import { deriveObligations, decideVerdict, assessAiAct, euEvidence, coverage, OBLIGATIONS, QUESTIONS, SHOW_IF } from './src/aiactAssess.js';
import { QUESTION_TEXT, REQUIRED } from './web/app/aiact/questions.mjs';
import { rigaCategoria } from './web/app/report/riga.mjs';
import fs from 'node:fs';
import { en } from './web/app/translations/en.js';
import { de as UI_DE } from './web/app/translations/de.js';
import { fr as UI_FR } from './web/app/translations/fr.js';
import { es as UI_ES } from './web/app/translations/es.js';
import { pt as UI_PT } from './web/app/translations/pt.js';
import { msg, errorText } from './src/messages/index.js';
import { it as DIZ_IT } from './src/messages/it.js';
import { en as DIZ_EN } from './src/messages/en.js';
import { de as DIZ_DE } from './src/messages/de.js';
import { fr as DIZ_FR } from './src/messages/fr.js';
import { es as DIZ_ES } from './src/messages/es.js';
import { pt as DIZ_PT } from './src/messages/pt.js';
const DIZ = { it: DIZ_IT, en: DIZ_EN, de: DIZ_DE, fr: DIZ_FR, es: DIZ_ES, pt: DIZ_PT };

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
{
  // robots.txt di Wikipedia: «Mediapartners-Google*» con «Disallow: /» NON è il gruppo '*'.
  const r = parseRobots('User-agent: Mediapartners-Google*\nDisallow: /\n\nUser-agent: *\nDisallow: /w/\n');
  ok(r.isAllowed('*', '/') === true, 'robots: un agent col * finale non cattura il gruppo *');
  ok(r.isAllowed('Mediapartners-Google', '/') === false, 'robots: il * finale vale per il suo crawler');
  ok(r.isAllowed('Googlebot', '/') === true && r.isAllowed('Googlebot', '/w/x') === false, 'robots: Googlebot cade sul gruppo *');
}
{
  // RFC 9309 §2.2.1: token per uguaglianza (non sottostringa), gruppi dello stesso crawler uniti.
  const r = parseRobots('User-agent: GPTBot\nDisallow: /a\n\nUser-agent: gptbot\nDisallow: /b\n\nUser-agent: bot\nDisallow: /\n');
  ok(r.isAllowed('GPTBot', '/a') === false && r.isAllowed('GPTBot', '/b') === false, 'robots: gruppi dello stesso crawler uniti');
  ok(r.isAllowed('GPTBot', '/') === true, 'robots: «bot» non cattura GPTBot per sottostringa');
}

// weights.mjs — profilo EVIDENCE-2026: i pesi sono una dichiarazione pubblica, non un dettaglio interno
{
  const somma = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  ok(Math.abs(somma - 1) < 1e-9, 'pesi: la somma fa esattamente 1.00 (avuta ' + somma + ')');
  ok(PROFILE === 'EVIDENCE-2026', 'pesi: il profilo si chiama EVIDENCE-2026: ' + PROFILE);
  ok(WEIGHTS.answerability === 0.25, 'pesi: answerability 0.25 (la categoria piu pesante)');
  ok(WEIGHTS.agentFiles === 0.05, 'pesi: agentFiles declassata a 0.05');
  ok(WEIGHTS.answerability > WEIGHTS.structured, 'pesi: answerability pesa piu di structured (evidenza Ahrefs sullo schema)');
  ok(Object.keys(WEIGHTS).length === 6, 'pesi: sei categorie pesate');
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
  ok(getMeta(`<meta content='a "b" c' property="og:title">`, 'og:title') === 'a "b" c', 'getMeta: content prima di property, virgolette miste');
  ok(getMeta('<META NAME="Description" CONTENT="Prezzi > 10 euro">', 'description') === 'Prezzi > 10 euro', 'getMeta: maiuscole e > dentro il valore');
  ok(getMeta('<meta data-name="description" content="no"><meta name="description" content="si">', 'description') === 'si', 'getMeta: data-name non conta come name');
  ok(getMeta('<meta property="og:image:alt" content="alt"><meta property="og:image" content="img">', 'og:image') === 'img', 'getMeta: og:image non pesca og:image:alt');
  // ReDoS: l'HTML lo sceglie chi lancia la scansione (fino a 3 MB). La vecchia regex impiegava
  // ~15 s su 200 KB di "<meta" ripetuto, bloccando l'unico processo Node per tutti.
  for (const [k, h] of [['<meta ripetuto', '<meta'.repeat(200_000)], ['virgolette aperte', '<meta "'.repeat(150_000)], ['tag lungo', '<meta ' + 'a '.repeat(500_000)]]) {
    const t0 = Date.now();
    getMeta(h, 'description');
    ok(Date.now() - t0 < 1000, 'getMeta lineare su HTML ostile (' + k + '): ' + (Date.now() - t0) + ' ms');
  }
  // Stesso rischio per contentHtml (usata da quasi ogni analisi) e per i blocchi JSON-LD:
  // [\s\S]*? senza chiusura ripartiva da capo a ogni apertura (1 MB = minuti, o peggio).
  for (const [k, h] of [['<!-- aperti', '<!--'.repeat(250_000)], ['<script aperti', '<script'.repeat(140_000)], ['<style aperti', '<style'.repeat(160_000)], ['ld+json senza >', '<script type="application/ld+json"'.repeat(30_000)], ['ld+json senza chiusura', '<script type="application/ld+json">'.repeat(28_000)]]) {
    const t0 = Date.now();
    contentHtml(h); jsonLdTypes(h); jsonLdCount(h);
    ok(Date.now() - t0 < 1000, 'contentHtml e JSON-LD lineari su HTML ostile (' + k + '): ' + (Date.now() - t0) + ' ms');
  }
  ok(contentHtml('a<!-- x -->b<SCRIPT>y</script>c<style>z</STYLE>d<noscript>n</noscript>e') === 'a b c d e', 'contentHtml: blocchi nascosti tolti, maiuscole comprese');
  ok(contentHtml('a<!-- x') === 'a<!-- x', 'contentHtml: blocco senza chiusura lasciato com\'era');
  // ReDoS, secondo giro: stesso rischio in ogni altra funzione che legge l'HTML della pagina.
  // Ogni caso è ~1 MB fatto ripetendo un'apertura senza chiusura (o un testo che la regex
  // rilegge da capo a ogni posizione): col codice vecchio da minuti a ore per caso.
  // Un seme [prefisso, ripetuto, suffisso] mette prefisso e suffisso una volta sola attorno al blocco ostile.
  const big = (s) => s.repeat(Math.ceil(1_000_000 / s.length));
  for (const [nome, f, semi] of [
    ['getTitle e deriveBrand', (h) => { getTitle(h); deriveBrand(h, 'e.it'); }, ['<title', '<title>']],
    ['bodyHtml e semanticRatio', (h) => { bodyHtml(h); semanticRatio(h); }, ['<body', '<body>']],
    ['imgAlt', imgAlt, ['<img']],
    ['htmlLang e pageLang', (h) => { htmlLang(h); pageLang(h); }, ['<html', '<']],
    ['wordCount', wordCount, ['<', '<script', '<style']],
    ['stripTags', stripTags, ['<']],
    ['links', (h) => links(h, 'e.it'), ['<a', '<a href=']],
    ['contentWords', contentWords, ['<', '<nav', '<header', '<footer']],
    ['sections', sections, ['<h2', '<h2>', ['<h2>a</h2>', '<p']]],
    ['paragraphWords', paragraphWords, ['<p', '<p>']],
    ['extractableBlocks', extractableBlocks, ['<ul', ['<ul>', '<li>', '</ul>'], ['<ul><li>a</li><li>a</li><li>', 'x<a>', '</li></ul>'], '<table']],
    ['citableEvidence', (h) => citableEvidence(h, 'e.it'), ['<p', '<p>', '1']],
    ['analyzeReadability', (h) => analyzeReadability({ served: h }, 'it'), ['<', '<body', '<img']],
    ['analyzeAnswerability', (h) => analyzeAnswerability({ served: h, host: 'e.it' }, 'it'), ['<body', '<p>uno ', '<h2>uno ', ['<ul>', '<li>uno ', '</ul>']]],
    ['analyzeStructured', (h) => analyzeStructured(h, 'it'), ['<link rel="alternate" ', '<meta ', '<link ']],
    ['headFlags', headFlags, ['<meta name="robots" ', '<meta content="noindex ', '<meta ', '<link ']],
    ['accessibleFormLabels e analyzeA11y', (h) => { accessibleFormLabels(h); analyzeA11y(h, 'it'); }, ['<b aria-hidden="true"', '<b aria-hidden="true">', '<label>', '<label for="a"', '<input', '<html', '<label>x</label><input>']],
    ['detectAiSignals', (h) => detectAiSignals(h), ['<', '<script', '<style', '<meta ', 'mediapipe']],
    ['significantLinks', (h) => significantLinks(h, 'https://e.it'), ['<a href="x"', '<a href="x">', '<a ']],
    ['linkLabel', (h) => linkLabel(h + 'x'), ['&nbsp;', ' ']],
    ['pagesFromLinks', (h) => pagesFromLinks(h, 'https://e.it'), ['<a', '<a href=']],
    ['parseContentUsage', (h) => parseContentUsage(null, h), ['\n']],
  ]) for (const s of semi) {
    const [pre, rep, post = ''] = Array.isArray(s) ? s : ['', s];
    const h = pre + big(rep) + post, t0 = Date.now();
    f(h);
    const ms = Date.now() - t0;
    ok(ms < 1000, nome + ' lineare su HTML ostile (' + JSON.stringify(s) + '): ' + ms + ' ms');
  }
  // headFlags: i tre segnali di <head> che audit.js leggeva con regex [^>]+ (quadratiche).
  ok(JSON.stringify(headFlags('<meta name="robots" content="noindex, follow"><meta name="viewport" content="width=device-width"><link rel="license" href="/l">')) === '{"noindex":true,"viewport":true,"license":true}', 'headFlags: i tre segnali letti');
  ok(headFlags('<meta content="NOINDEX" name="Robots">').noindex === true, 'headFlags: content prima di name, maiuscole comprese');
  ok(headFlags('<meta name="robots" content="index, follow">').noindex === false, 'headFlags: index non è noindex');
  ok(headFlags('<meta name="googlebot" content="noindex">').noindex === false, 'headFlags: conta solo il meta robots, come prima');
  ok(headFlags('<!-- <meta name="robots" content="noindex"> -->').noindex === false, 'headFlags: meta commentato ignorato');
  ok(JSON.stringify(headFlags('<p>niente</p>')) === '{"noindex":false,"viewport":false,"license":false}', 'headFlags: pagina senza segnali');
  ok(jsonLdCount('<script type="application/ld+json">{}</script><script>var s="<script type=\'x\'>"</script><script type=\'application/ld+json\'>[]</script>') === 2, 'jsonLdCount: due blocchi, virgolette singole comprese');
ok(jsonLdCount('<script>var s="<script type=\'application/ld+json\'>{}"</script>') === 0, 'jsonLdCount: un tag ld+json dentro una stringa JS non è un blocco');
  ok(jsonLdTypes(html).includes('Organization'), 'tipo JSON-LD rilevato');
  ok(semanticRatio(html).semantic === 2, 'tag semantici contati (header+main)');
  ok(imgAlt(html).total === 2 && imgAlt(html).withAlt === 1, 'alt immagini contate');
  ok(wordCount('<p>due parole</p>') === 2, 'word count ignora i tag');
}

// answer-readiness: helper di parsing. I falsi positivi vengono prima dei casi felici:
// un menu di navigazione NON è un blocco estraibile, e ogni sito WordPress ne ha uno.
{
  const menu = '<body><nav><ul><li><a href="/a">Home</a></li><li><a href="/b">Chi siamo</a></li><li><a href="/c">Contatti</a></li></ul></nav><main><p>testo</p></main></body>';
  const eb = extractableBlocks(menu);
  ok(eb.lists === 0, 'blocchi: la lista dentro <nav> non conta (avuti ' + eb.lists + ')');

  const footerMenu = '<body><footer><ul><li><a href="/x">Privacy</a></li><li><a href="/y">Cookie</a></li><li><a href="/z">Note legali</a></li></ul></footer></body>';
  ok(extractableBlocks(footerMenu).lists === 0, 'blocchi: la lista nel footer non conta');

  // Lista di soli link fuori da nav (widget "articoli recenti"): >70% link-only → esclusa.
  const widget = '<body><main><ul><li><a href="/1">Primo articolo</a></li><li><a href="/2">Secondo articolo</a></li><li><a href="/3">Terzo articolo</a></li></ul></main></body>';
  ok(extractableBlocks(widget).lists === 0, 'blocchi: lista di soli link esclusa (widget, non contenuto)');

  // Lista vera di contenuto: conta.
  const vera = '<body><main><ul><li>Il primo passo è verificare il robots.txt del sito</li><li>Il secondo è controllare la sitemap</li><li>Il terzo è misurare il testo servito senza JavaScript</li></ul></main></body>';
  ok(extractableBlocks(vera).lists === 1, 'blocchi: lista di contenuto conta');

  // Lista corta: sotto i 3 <li> non è un blocco.
  ok(extractableBlocks('<body><main><ul><li>uno che dice qualcosa</li><li>due che dice altro</li></ul></main></body>').lists === 0, 'blocchi: meno di 3 voci non conta');

  // Tabella: solo con intestazioni (una tabella di layout non è dato estraibile).
  ok(extractableBlocks('<body><main><table><tr><th>A</th></tr><tr><td>1</td></tr></table></main></body>').tables === 1, 'blocchi: tabella con <th> conta');
  ok(extractableBlocks('<body><main><table><tr><td>layout</td></tr></table></main></body>').tables === 0, 'blocchi: tabella senza <th> non conta');

  // Lista con sotto-elenco annidato (istruzioni passo-passo): il backreference sul
  // nome di tag si fermava al primo </ul> omonimo, cioe quello della sotto-lista
  // interna, azzerando la lista esterna. Deve valere 1, non 0 e non 2.
  const passi = '<body><main><ul>'
    + '<li>Verifica il robots.txt del sito<ul><li>controlla lo user-agent</li><li>controlla il percorso disallow</li></ul></li>'
    + '<li>Controlla la sitemap XML</li>'
    + '<li>Misura il testo servito senza JavaScript</li>'
    + '</ul></main></body>';
  ok(extractableBlocks(passi).lists === 1, 'blocchi: lista con sotto-elenco annidato conta 1 (avuti ' + extractableBlocks(passi).lists + ')');
}
{
  // sections(): prima frase dopo ogni H2/H3, in parole.
  const html = '<body><main>'
    + '<h2>Che cos\'è il GEO?</h2><p>È la disciplina che rende un sito citabile dai motori generativi. Segue una spiegazione molto più lunga che non deve entrare nel conteggio della prima frase.</p>'
    + '<h3>Serve a tutti?</h3><p>' + 'parola '.repeat(80) + 'fine.</p>'
    + '</main></body>';
  const s = sections(html);
  ok(s.length === 2, 'sezioni: due heading H2/H3 trovati (avuti ' + s.length + ')');
  ok(s[0].heading.includes('GEO'), 'sezioni: testo dell\'heading estratto senza tag');
  ok(s[0].firstSentenceWords >= 10 && s[0].firstSentenceWords <= 16, 'sezioni: prima frase misurata, non tutto il paragrafo: ' + s[0].firstSentenceWords);
  ok(s[1].firstSentenceWords > 70, 'sezioni: paragrafo senza punto fermo conta come frase lunga: ' + s[1].firstSentenceWords);
  ok(sections('<body><main><p>nessun heading</p></main></body>').length === 0, 'sezioni: nessun H2/H3 → array vuoto');

  // Un h3 nel footer (widget "Iscriviti alla newsletter") non e una sezione di
  // contenuto: extractableBlocks gia esclude nav/header/footer, sections deve farlo
  // allo stesso modo, altrimenti ogni sito WordPress guadagna punti dal proprio footer.
  const conFooter = '<body><main><h2>Come funziona il GEO</h2><p>Il GEO ottimizza i contenuti per i motori generativi, non solo per Google.</p></main>'
    + '<footer><h3>Iscriviti alla newsletter</h3><p>Ricevi aggiornamenti ogni settimana sul mondo GEO.</p></footer></body>';
  const sf = sections(conFooter);
  ok(sf.length === 1, 'sezioni: heading nel footer escluso (avuti ' + sf.length + ')');
}
{
  // paragraphWords(): i paragrafi sotto le 10 parole (didascalie, note) non entrano nella distribuzione.
  const html = '<body><main><p>' + 'parola '.repeat(150) + '</p><p>Foto: archivio</p><p>' + 'parola '.repeat(40) + '</p></main></body>';
  const p = paragraphWords(html);
  ok(p.total === 2, 'paragrafi: didascalia sotto le 10 parole esclusa (totale ' + p.total + ')');
  ok(p.long === 1, 'paragrafi: uno solo oltre le 120 parole');
}
{
  // citableEvidence(): numeri con unità, citazioni, link esterni dentro il testo.
  const html = '<body><main><p>Nel 2026 il 97% dei file non viene letto, su 137.210 domini.</p>'
    + '<blockquote>Correlazione non è causalità.</blockquote>'
    + '<p>Fonte: <a href="https://ahrefs.com/blog/llmstxt-study/">studio Ahrefs</a> e <a href="/interno">pagina interna</a>.</p>'
    + '</main></body>';
  const ev = citableEvidence(html, 'esempio.it');
  ok(ev.numbers >= 3, 'evidenza: percentuale, anno e numero grande contati (' + ev.numbers + ')');
  ok(ev.quotes === 1, 'evidenza: blockquote contato');
  ok(ev.extLinks === 1, 'evidenza: solo il link esterno conta, non quello interno (' + ev.extLinks + ')');

  // Boilerplate di testata (telefono, anno "dal 2015") non e evidenza dell'articolo:
  // extractableBlocks/sections escludono gia <header>, citableEvidence deve fare lo stesso.
  const conHeader = '<body><header><p>Chiamaci al numero 091 123 45 67, dal 2015 al vostro servizio.</p></header>'
    + '<main><p>Il nostro studio segue clienti in Ticino dal 2015.</p></main></body>';
  const evh = citableEvidence(conHeader, 'esempio.it');
  ok(evh.numbers === 1, 'evidenza: numeri nella testata esclusi, resta solo l\'anno nel main (avuti ' + evh.numbers + ')');
}
{
  ok(htmlLang('<html lang="de-CH"><body></body></html>') === 'de', 'lingua: <html lang="de-CH"> → de');
  ok(htmlLang('<html><body></body></html>') === null, 'lingua: senza attributo → null');
  ok(stripTags('<p>uno <b>due</b>&nbsp;tre</p>').trim() === 'uno due tre', 'stripTags: tag via, entità collassata');
}

// answerability: la pagina che non è contenuto non va penalizzata, va esclusa.
{
  const breve = '<html lang="it"><body><main><h1>Contatti</h1><p>Scrivici a info@esempio.it oppure chiamaci in orario di ufficio.</p></main></body></html>';
  const a = analyzeAnswerability({ served: breve, host: 'esempio.it' });
  ok(a.unmeasured === true, 'answerability: sotto le 300 parole la categoria esce dal punteggio');
  ok(a.checks.length === 1 && a.checks[0].status === 'info', 'answerability: unmeasured spiega perché, senza fix inventati');
}
{
  // Pagina IDEALE: risposta breve dopo ogni heading, liste, paragrafi corti, dati -
  // tutti e cinque i controlli in "good". Il paragrafo lungo della versione precedente
  // (200 ripetizioni in un solo <p>) faceva scattare il crit sui paragrafi nonostante
  // gli altri assert restassero verdi (>= 70 e >= 4 buoni non inchiodavano i pesi
  // esatti) - round di review 1, finding 6. Diviso in piu paragrafi corti: ora
  // score === 100 inchioda la somma dei pesi (25+20+20+15+20).
  const buona = '<html lang="it"><body><main><h1>Guida</h1>'
    + '<h2>Che cos\'è il GEO?</h2><p>È la disciplina che rende un sito citabile dai motori generativi.</p>'
    + '<p>' + 'parola '.repeat(60) + '</p>'
    + '<h2>Quanto conta il robots.txt?</h2><p>Conta meno di quanto si creda, secondo i dati.</p>'
    + '<p>Nel 2026 il 95% delle pagine citate bloccava GPTBot, su 4.000.000 di citazioni analizzate.</p>'
    + '<ul><li>Verifica il testo servito senza JavaScript</li><li>Controlla la sitemap dichiarata</li><li>Misura le liste e le tabelle della pagina</li></ul>'
    + '<blockquote>Correlazione non è causalità.</blockquote>'
    + '<p>Fonte: <a href="https://ahrefs.com/blog/">Ahrefs</a>. ' + 'parola '.repeat(60) + '</p>'
    + '<p>' + 'parola '.repeat(60) + '</p>'
    + '<p>' + 'parola '.repeat(60) + '</p>'
    + '</main></body></html>';
  const a = analyzeAnswerability({ served: buona, host: 'esempio.it' });
  ok(!a.unmeasured, 'answerability: pagina oltre le 300 parole viene misurata');
  ok(a.checks.length === 5, 'answerability: cinque check (avuti ' + a.checks.length + ')');
  ok(a.checks.every((c) => c.status === 'good'), 'answerability: pagina ideale, tutti i controlli good: ' + a.checks.map((c) => c.status));
  ok(a.score === 100, 'answerability: pagina ideale inchioda la somma dei pesi a 100 (avuto ' + a.score + ')');
}
{
  // Muro di testo: 800 parole in un solo paragrafo, nessuna lista, nessun heading.
  const muro = '<html lang="it"><body><main><h1>Servizi</h1><p>' + 'parola '.repeat(800) + '</p></main></body></html>';
  const a = analyzeAnswerability({ served: muro, host: 'esempio.it' });
  ok(a.score < 40, 'answerability: muro di testo bocciato: ' + a.score);
  ok(a.checks.some((c) => c.status === 'crit'), 'answerability: almeno un check critico sul muro di testo');
  ok(a.checks.every((c) => c.status !== 'crit' || c.fix), 'answerability: ogni check critico porta un fix azionabile');
}
{
  // Titoli-domanda: la lingua è quella della PAGINA, non quella del report.
  ok(isQuestionHeading('Wie funktioniert das?', 'de'), 'domanda: punto interrogativo riconosciuto in qualsiasi lingua');
  ok(isQuestionHeading('Warum Beacon', 'de'), 'domanda: parola interrogativa tedesca senza punto');
  ok(isQuestionHeading('O que é GEO', 'pt'), 'domanda: bigramma portoghese "o que"');
  ok(!isQuestionHeading('O nosso metodo', 'pt'), 'domanda: articolo iniziale non è una domanda (falso positivo di "o")');
  ok(isQuestionHeading('Come funziona', 'it'), 'domanda: parola interrogativa italiana');
  ok(!isQuestionHeading('Comunicazione e stampa', 'it'), 'domanda: "Comunicazione" non è "come" (match su parola intera)');
  // titoli di menu, non domande: falso positivo su pagina aziendale reale (review 1, finding 3)
  ok(!isQuestionHeading('Chi siamo', 'it'), 'domanda: "Chi siamo" e un titolo di menu, non una domanda');
  ok(!isQuestionHeading('Dove siamo', 'it'), 'domanda: "Dove siamo" e un titolo di menu, non una domanda');
  ok(!isQuestionHeading('Come raggiungerci', 'it'), 'domanda: "Come raggiungerci" e un titolo di menu, non una domanda');
  ok(!isQuestionHeading('Quem somos', 'pt'), 'domanda: "Quem somos" (pt) e un titolo di menu, non una domanda');

  const de = '<html lang="de"><body><main><h2>Wie funktioniert Beacon?</h2><p>Kurz gesagt: es misst.</p><p>' + 'wort '.repeat(400) + '</p></main></body></html>';
  const a = analyzeAnswerability({ served: de, host: 'esempio.de' }, 'it');
  const q = a.checks.find((c) => c.name.toLowerCase().includes('domanda'));
  ok(q && q.status === 'good', 'answerability: heading tedesco valutato in tedesco anche con report in italiano');
}
{
  // review 1, finding critico: il gate delle 300 parole deve girare sul contenuto
  // reale (contentWords), non sulla pagina intera (wordCount) - altrimenti un chrome
  // pesante (menu, testata, footer) puo far passare il gate una pagina di contatti.
  const contatti = '<html lang="it"><body>'
    + '<header><p>' + 'avviso '.repeat(200) + '</p></header>'
    + '<nav><ul>'
    + '<li><a href="/">Pagina iniziale del sito</a></li><li><a href="/chi-siamo">Chi siamo e la nostra storia</a></li>'
    + '<li><a href="/servizi">Tutti i nostri servizi disponibili</a></li><li><a href="/blog">Blog e approfondimenti tematici</a></li>'
    + '<li><a href="/eventi">Calendario degli eventi in programma</a></li><li><a href="/news">Ultime notizie e comunicati</a></li>'
    + '<li><a href="/faq">Domande frequenti e risposte utili</a></li><li><a href="/team">Il nostro team di collaboratori</a></li>'
    + '<li><a href="/partner">I partner che sostengono il progetto</a></li><li><a href="/sostegno">Come sostenere le nostre attivita</a></li>'
    + '<li><a href="/dona">Fai una donazione libera oggi</a></li><li><a href="/volontari">Diventa volontario con noi</a></li>'
    + '<li><a href="/press">Rassegna stampa e comunicati ufficiali</a></li><li><a href="/contatti">Contatti e informazioni utili</a></li>'
    + '</ul></nav>'
    + '<main><h1>Contatti</h1><p>Scrivici a info@esempio.it oppure chiamaci in orario di ufficio per qualsiasi informazione sui nostri servizi e sulle nostre attivita sul territorio.</p></main>'
    + '<footer><p>Indirizzo: Via Esempio numero 1, 6500 Bellinzona, Canton Ticino, Svizzera. Orari di apertura: dal lunedi al venerdi dalle 9 alle 18, sabato su appuntamento. Registro di commercio numero CH-123.456.789. Dal 2015 siamo al servizio della regione, con sedi anche a Lugano e a Locarno per meglio servire la clientela in tutto il territorio del Cantone.</p></footer>'
    + '</body></html>';
  ok(wordCount(contatti) >= 300, 'answerability: pagina di controllo, wordCount pagina intera (col chrome) supera 300 (avuto ' + wordCount(contatti) + ')');
  ok(contentWords(contatti) < 300, 'lib: contentWords esclude il chrome e resta sotto 300 (avuto ' + contentWords(contatti) + ')');
  const a = analyzeAnswerability({ served: contatti, host: 'esempio.it' });
  ok(a.unmeasured === true, 'answerability: senza contentWords il gate delle 300 sarebbe stato aggirato dal chrome');
}
{
  // review 1, finding importante: paragraphWords era l'unico dei quattro helper senza
  // filtro chrome - un <p> lungo dentro <footer> sporcava il conteggio dei paragrafi.
  const conFooterLungo = '<html><body><main><p>' + 'parola '.repeat(15) + '</p></main><footer><p>' + 'parola '.repeat(160) + '</p></footer></body></html>';
  const pw = paragraphWords(conFooterLungo);
  ok(pw.total === 1 && pw.long === 0, 'lib: paragraphWords ignora i <p> dentro <footer> (avuto ' + JSON.stringify(pw) + ')');
}
{
  // review 1, finding importante: match sovrapposti (unita di misura + migliaia) non
  // vanno contati due volte per lo stesso numero, es. "1.500 CHF".
  const ev = citableEvidence('<p>pacchetti da 1.500 CHF, 2.300 CHF e 4.900 CHF.</p>', 'esempio.it');
  ok(ev.numbers === 3, 'lib: citableEvidence deduplica match sovrapposti sullo stesso numero (avuto ' + ev.numbers + ')');
}
{
  // review 1, finding importante: con un numero pari di sezioni la mediana e la media
  // dei due valori centrali (20 e 40 -> 30), non il valore superiore (40, che darebbe
  // "warn" invece di "good").
  const medianTest = '<html lang="it"><body><main><h1>Test mediana</h1>'
    + '<h2>Domanda uno?</h2><p>' + 'parola '.repeat(19) + 'fine.</p>'
    + '<h2>Domanda due?</h2><p>' + 'parola '.repeat(39) + 'fine.</p>'
    + '<p>' + 'parola '.repeat(250) + '</p>'
    + '</main></body></html>';
  const a = analyzeAnswerability({ served: medianTest, host: 'esempio.it' });
  ok(a.checks[0].status === 'good', 'answerability: mediana vera (30) su 2 sezioni, non il valore superiore (40): ' + a.checks[0].detail);
}
{
  ok(pageLang('<html lang="fr"><body></body></html>') === 'fr', 'pageLang: attributo lang rispettato');
  ok(pageLang('<html><body><p>Il sito è una vetrina che non ha dichiarato la lingua nel markup</p></body></html>') === 'it', 'pageLang: fallback euristico sulle stopword italiane');
  ok(pageLang('<html><body><p>The site does not declare its language in the markup and that is the case here</p></body></html>') === 'en', 'pageLang: fallback euristico sulle stopword inglesi');
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
// access: la separazione fra training e retrieval è una tassonomia, se un bot nuovo
// entra in AI_CRAWLERS senza essere classificato, il report mente per omissione.
{
  const uniti = [...TRAINING_CRAWLERS, ...RETRIEVAL_CRAWLERS];
  const orfani = AI_CRAWLERS.filter((ua) => !uniti.includes(ua));
  ok(orfani.length === 0, 'access: ogni crawler è classificato training o retrieval (orfani: ' + orfani.join(', ') + ')');
  const doppi = uniti.filter((ua) => TRAINING_CRAWLERS.includes(ua) && RETRIEVAL_CRAWLERS.includes(ua));
  ok(doppi.length === 0, 'access: nessun crawler in entrambi i gruppi (' + doppi.join(', ') + ')');
  ok(RETRIEVAL_CRAWLERS.includes('OAI-SearchBot') && RETRIEVAL_CRAWLERS.includes('PerplexityBot'), 'access: i bot di retrieval live sono nel gruppo giusto');
  ok(TRAINING_CRAWLERS.includes('GPTBot') && TRAINING_CRAWLERS.includes('Google-Extended'), 'access: i bot di training sono nel gruppo giusto');
}
{
  // Bloccare solo il training pesa poco; bloccare il retrieval pesa molto.
  const tutti = {}; for (const ua of AI_CRAWLERS) tutti[ua] = true;
  const soloTraining = { ...tutti }; for (const ua of TRAINING_CRAWLERS) soloTraining[ua] = false;
  const soloRetrieval = { ...tutti }; for (const ua of RETRIEVAL_CRAWLERS) soloRetrieval[ua] = false;
  const live = {}; for (const ua of LIVE_UA) live[ua] = { ok: true };

  const aT = analyzeAccess({ robotsAllowed: soloTraining, liveFetch: live });
  const aR = analyzeAccess({ robotsAllowed: soloRetrieval, liveFetch: live });
  ok(aR.score < aT.score, 'access: bloccare il retrieval live costa più che bloccare il training (' + aR.score + ' < ' + aT.score + ')');
  ok(aT.checks.length === 3, 'access: tre check, training, retrieval, fetch live');
  const tr = aT.checks.find((c) => c.name.toLowerCase().includes('training'));
  ok(tr && /archivi|già raccolt/i.test(tr.detail), 'access: il check training spiega che il blocco non riduce le citazioni di oggi');
  ok(!tr.fix, 'access: nessun fix che chiede di aprire i bot di training, è una scelta del sito');

  // liveFetch pesa più del robots: un WAF che blocca tutto affonda il punteggio
  // anche con un robots.txt perfetto.
  const liveKo = {}; for (const ua of LIVE_UA) liveKo[ua] = { ok: false };
  const aperto = analyzeAccess({ robotsAllowed: tutti, liveFetch: liveKo });
  ok(aperto.score <= 55, 'access: robots aperto ma WAF che blocca → punteggio basso: ' + aperto.score);
}
{
  // agentFiles: il punteggio sta su robots.txt e sitemap (scopribilità reale).
  // llms.txt compare come check ma NON contribuisce: misurato su 137.210 domini,
  // il 97% dei file non viene mai letto (Ahrefs).
  const senzaLlms = analyzeAgentFiles({ robotsTxt: true, sitemap: true, llmsTxt: false, skillMd: false, mcpJson: false, agentSkills: false });
  ok(senzaLlms.score === 100, 'agentFiles: robots + sitemap = 100 anche senza llms.txt (avuto ' + senzaLlms.score + ')');
  const conLlms = analyzeAgentFiles({ robotsTxt: true, sitemap: true, llmsTxt: true, skillMd: false, mcpJson: false, agentSkills: false });
  ok(conLlms.score === senzaLlms.score, 'agentFiles: llms.txt non muove il punteggio');
  const llmsCheck = conLlms.checks.find((c) => c.name.includes('llms.txt'));
  ok(llmsCheck && llmsCheck.status === 'info', 'agentFiles: llms.txt è un check informativo');
  ok(llmsCheck && !llmsCheck.fix, 'agentFiles: nessun fix che promette citazioni per llms.txt');
  ok(/97%|non viene mai letto/i.test(llmsCheck.detail), 'agentFiles: il dettaglio dichiara l\'uso reale del file');
  const nudo = analyzeAgentFiles({ robotsTxt: false, sitemap: false, llmsTxt: true, skillMd: true, mcpJson: true, agentSkills: true });
  ok(nudo.score === 0, 'agentFiles: senza robots né sitemap il punteggio è 0 anche con tutti i file di moda: ' + nudo.score);
  ok(conLlms.checks.length === 2, 'agentFiles: due check, le convenzioni si sono spostate in agentReady');
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
{
  // B1-B4: controlli SEO tecnici (src/seoTech.js), offline con HTML e header di fixture.
  const seo = (o) => analyzeTech({ https: true, noindex: false, viewport: true, statusOk: true, seo: { robotsOk: true, robotsTxt: 'User-agent: *\nDisallow:\nSitemap: https://e.it/s.xml', finalUrl: 'https://e.it/p', html: '', headers: null, probes: null, ...o } });
  const by = (r, s) => r.checks.find((c) => c.name.startsWith(s));
  const base = seo({});
  ok(base.score === 100 && base.checks.length > 4, 'seo: punteggio tech invariato, check accodati');
  ok(analyzeTech({ https: true, noindex: false, viewport: true, statusOk: true }).checks.length === 4, 'seo: senza input i check restano 4');
  ok(seo({ robotsTxt: 'User-agent: Mediapartners-Google*\nDisallow: /\n\nUser-agent: *\nDisallow: /w/\n' }).score === 100, 'seo: robots tipo Wikipedia non è un blocco totale');
  // ReDoS su HTML ostile da ~1 MB: tutti i controlli B1-B4 insieme restano sotto il secondo.
  for (const [k, h] of [['tag link lungo', '<link ' + 'a'.repeat(1_000_000)], ['<link ripetuto', '<link'.repeat(200_000)], ['<meta ripetuto', '<meta'.repeat(200_000)], ['<!-- aperti', '<!--'.repeat(250_000)], ['ld+json senza >', '<script type="application/ld+json"'.repeat(30_000)], ['ld+json senza chiusura', '<script type="application/ld+json">'.repeat(28_000)]]) {
    const t0 = Date.now();
    seo({ html: h });
    ok(Date.now() - t0 < 1000, 'seo: lineare su HTML ostile (' + k + '): ' + (Date.now() - t0) + ' ms');
  }
  // B1
  ok(by(seo({ headers: { 'X-Robots-Tag': 'noindex, nofollow' } }), 'Direttive').status === 'crit', 'seo B1: X-Robots-Tag noindex = crit');
  ok(by(seo({ headers: { 'X-Robots-Tag': 'otherbot: noindex' } }), 'Direttive').status === 'good', 'seo B1: noindex per altro bot ignorato');
  ok(by(seo({ html: '<meta name="robots" content="index, nofollow">' }), 'Direttive').status === 'warn', 'seo B1: meta nofollow = warn');
  ok(by(seo({ robotsTxt: 'User-agent: *\nDisallow: /' }), 'robots.txt: blocchi').status === 'crit', 'seo B1: Disallow / = crit');
  ok(by(seo({ robotsTxt: 'User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow:' }), 'robots.txt: blocchi').status === 'crit', 'seo B1: Googlebot bloccato = crit');
  ok(by(seo({ robotsTxt: 'User-agent: *\nDisallow: /admin' }), 'Riga Sitemap').status === 'warn', 'seo B1: Sitemap assente = warn');
  ok(by(seo({}), 'Riga Sitemap').status === 'good' && by(seo({}), 'robots.txt: blocchi').status === 'good', 'seo B1: robots sano = good');
  // B2
  const can = (h, u) => by(seo({ html: h, finalUrl: u || 'https://e.it/p' }), 'Canonical').status;
  ok(can('<link rel="canonical" href="https://e.it/p/">') === 'good', 'seo B2: canonical coerente (slash finale ignorato)');
  ok(can('') === 'warn' && can('<link rel="canonical" href="/p">') === 'warn', 'seo B2: assente o relativo = warn');
  ok(can('<link rel="canonical" href="https://e.it/a"><link rel="canonical" href="https://e.it/b">') === 'warn', 'seo B2: doppio canonical = warn');
  ok(can('<link rel="canonical" href="https://altro.it/p">') === 'warn' && can('<link rel="canonical" href="https://e.it/altra">') === 'warn', 'seo B2: canonical altrove = warn');
  const hl = (h) => by(seo({ html: h }), 'Hreflang');
  ok(!hl('<html></html>'), 'seo B2: senza hreflang il check non compare');
  ok(hl('<link rel="alternate" hreflang="it" href="https://e.it/p"><link rel="alternate" hreflang="en" href="https://e.it/en/p"><link rel="alternate" hreflang="x-default" href="https://e.it/p">').status === 'good', 'seo B2: hreflang completo = good');
  const hbad = hl('<link rel="alternate" hreflang="italiano" href="https://e.it/x"><link rel="alternate" hreflang="en" href="https://e.it/en/p">');
  ok(hbad.status === 'warn' && /italiano/.test(hbad.detail) && /x-default/.test(hbad.detail), 'seo B2: codice non valido, niente x-default e niente rimando a sé');
  // B3 (probes simulate)
  const pr = (o) => ({ http: { ok: true, hops: [], finalUrl: 'https://e.it/' }, www: { ok: false, hops: [], finalUrl: '', variant: 'www.e.it' }, chain: { ok: true, hops: [], finalUrl: 'https://e.it/p' }, ...o });
  ok(by(seo({ probes: pr({}) }), 'Da http').status === 'good', 'seo B3: http→https = good');
  ok(by(seo({ probes: pr({ http: { ok: true, hops: [], finalUrl: 'http://e.it/' } }) }), 'Da http').status === 'crit', 'seo B3: http che resta http = crit');
  ok(by(seo({ probes: pr({ chain: { ok: true, hops: [{ url: 'a' }, { url: 'b' }], finalUrl: 'c' } }) }), 'Catena').status === 'warn', 'seo B3: 2 salti = warn');
  ok(by(seo({ probes: pr({}) }), 'Variante www').status === 'info', 'seo B3: www che non risolve = info, non errore');
  ok(by(seo({ probes: pr({ www: { ok: true, finalUrl: 'https://www.e.it/', variant: 'www.e.it' } }) }), 'Variante www').status === 'warn', 'seo B3: www servito su host diverso = warn');
  ok(by(seo({ probes: pr({ www: { ok: true, finalUrl: 'https://e.it/', variant: 'www.e.it' } }) }), 'Variante www').status === 'good', 'seo B3: www che rimanda al principale = good');
  const hdrAll = { 'Strict-Transport-Security': 'max-age=1', 'Content-Security-Policy': "default-src 'self'", 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
  ok(by(seo({ headers: hdrAll }), 'Header di sicurezza').status === 'good', 'seo B3: 4 header = good');
  const hmiss = by(seo({ headers: { 'X-Content-Type-Options': 'sniff' } }), 'Header di sicurezza');
  ok(hmiss.status === 'warn' && /HSTS/.test(hmiss.detail) && /X-Content-Type-Options/.test(hmiss.detail), 'seo B3: header mancanti elencati');
  ok(!by(seo({}), 'Header di sicurezza'), 'seo B3: senza header (snapshot) il check è omesso');
  // B4
  const ld = (j) => `<script type="application/ld+json">${j}</script>`;
  ok(by(seo({ html: ld('{"@type":"Organization",') }), 'JSON-LD: sintassi').status === 'crit', 'seo B4: JSON-LD rotto = crit');
  ok(by(seo({ html: ld('{"@type":"Organization","name":"X","url":"https://e.it"}') }), 'JSON-LD: proprietà').status === 'good', 'seo B4: Organization completa = good');
  const lp = by(seo({ html: ld('{"@graph":[{"@type":"Article","headline":"h"},{"@type":"WebSite","name":"n","url":"u"}]}') }), 'JSON-LD: proprietà');
  ok(lp.status === 'warn' && /Article: image, datePublished, author/.test(lp.detail) && !/WebSite/.test(lp.detail), 'seo B4: proprietà mancanti dentro @graph');
  ok(!by(seo({}), 'JSON-LD: sintassi'), 'seo B4: senza JSON-LD i check non compaiono');
  const og4 = '<meta property="og:title" content="t"><meta property="og:description" content="d"><meta property="og:image" content="i"><meta property="og:url" content="u">';
  ok(by(seo({ html: og4 }), 'Open Graph').status === 'info', 'seo B4: OG completo senza image:alt = info (consiglio)');
  ok(by(seo({ html: og4 + '<meta property="og:image:alt" content="a">' }), 'Open Graph').status === 'good', 'seo B4: OG completo = good');
  ok(/og:image/.test(by(seo({ html: '<meta property="og:title" content="t">' }), 'Open Graph').detail), 'seo B4: OG incompleto elenca i mancanti');
  {
    // safeFetch.hops (su cui poggia traceRedirects): safeFetch non usa globalThis.fetch ma
    // pinnedFetch, quindi server locale. Il guard vede un IP pubblico finto (resolver di test),
    // la connessione va a 127.0.0.1 (`_lookup` di test): niente DNS né rete esterna.
    const http = await import('node:http');
    const R = { '/': [301, '/a'], '/a': [302, '/it'], '/it': [200, null] };
    const srv = http.createServer((q, s) => { const [st, loc] = R[q.url] || [404, null]; s.writeHead(st, loc ? { location: loc } : {}); s.end('x'); });
    await new Promise((r) => srv.listen(0, '127.0.0.1', r));
    const base = `http://b3.test:${srv.address().port}`;
    const loop = (h, o, cb) => { if (typeof o === 'function') { cb = o; o = {}; } o.all ? cb(null, [{ address: '127.0.0.1', family: 4 }]) : cb(null, '127.0.0.1', 4); };
    __setResolverForTests(async () => [{ address: '93.184.216.34', family: 4 }]);
    try {
      const tr = await safeFetch(base + '/', { _lookup: loop });
      ok(tr.res.status === 200 && tr.hops.length === 2 && tr.hops[0].status === 301 && tr.finalUrl.endsWith('/it'), 'seo B3: safeFetch conta i salti (base di traceRedirects)');
      const zero = await safeFetch(base + '/it', { _lookup: loop });
      ok(zero.hops.length === 0, 'seo B3: nessun salto = hops vuoto');
      ok((await traceRedirects('http://127.0.0.1/')).ok === false, 'seo B3: IP interno bloccato dal guard anche nella sonda');
    } finally { __setResolverForTests(null); srv.close(); }
  }
  ok(by(analyzeTech({ https: true, noindex: false, viewport: true, statusOk: true, seo: { robotsOk: true, robotsTxt: '', finalUrl: 'https://e.it/', html: '', headers: null, probes: null } }, 'en'), 'Canonical').detail.length > 0, 'seo: i18n en');
}
{
  // agentReady — informativa per scelta: nessuna evidenza che questi segnali correlino
  // con le citazioni, e pesarli perché sono moderni ripeterebbe l'errore di llms.txt.
  const vuoto = analyzeAgentReady({
    contentUsage: { source: null, raw: null },
    botAuth: { browserOk: true, aiOk: 5, aiTotal: 5 },
    webmcp: { rendered: false, api: null },
    conventions: { skillMd: false, mcpJson: false, agentSkills: false },
  });
  ok(vuoto.informational === true, 'agentReady: informativa, non pesata');
  ok(vuoto.checks.length === 4, 'agentReady: quattro check (avuti ' + vuoto.checks.length + ')');
  ok(vuoto.checks.every((c) => c.status !== 'crit'), 'agentReady: nessun check critico — sono standard nascenti, non difetti');

  const pieno = analyzeAgentReady({
    contentUsage: { source: 'header', raw: 'train-ai=n, search=y' },
    botAuth: { browserOk: true, aiOk: 5, aiTotal: 5 },
    webmcp: { rendered: true, api: 'document.modelContext' },
    conventions: { skillMd: true, mcpJson: true, agentSkills: true },
  });
  ok(pieno.score > vuoto.score, 'agentReady: dichiarare gli standard alza il punteggio informativo');
  ok(pieno.checks.some((c) => c.detail.includes('train-ai=n')), 'agentReady: il valore AIPREF dichiarato viene mostrato');

  // Web Bot Auth: Beacon NON può verificare la config del WAF dall'esterno e lo dice.
  const filtrato = analyzeAgentReady({
    contentUsage: { source: null, raw: null },
    botAuth: { browserOk: true, aiOk: 1, aiTotal: 5 },
    webmcp: { rendered: false, api: null },
    conventions: { skillMd: false, mcpJson: false, agentSkills: false },
  });
  const ba = filtrato.checks.find((c) => c.name.includes('Web Bot Auth'));
  ok(ba && ba.status === 'warn', 'agentReady: divergenza browser/AI segnalata come filtro per user-agent');
  ok(ba.detail.includes('non può verificare') || ba.limit, 'agentReady: il limite di misura è dichiarato, non nascosto');

  // Nessun rendering JS: WebMCP non è valutabile e non deve risultare "assente".
  const senzaRender = analyzeAgentReady({
    contentUsage: { source: null, raw: null },
    botAuth: { browserOk: true, aiOk: 5, aiTotal: 5 },
    webmcp: { rendered: false, api: null },
    conventions: { skillMd: false, mcpJson: false, agentSkills: false },
  });
  const mcp = senzaRender.checks.find((c) => c.name.includes('WebMCP'));
  ok(mcp.status === 'info' && /rendering/i.test(mcp.detail), 'agentReady: senza rendering JS WebMCP è "non valutabile", non "assente"');
}
{
  // parseContentUsage: header o robots.txt, entrambi validi per AIPREF.
  ok(parseContentUsage(null, 'User-agent: *\nContent-Usage: train-ai=n\n').source === 'robots', 'AIPREF: regola nel robots.txt riconosciuta');
  ok(parseContentUsage('train-ai=n, search=y', '').source === 'header', 'AIPREF: header HTTP ha precedenza');
  ok(parseContentUsage(null, 'User-agent: *\nDisallow:\n').source === null, 'AIPREF: nessuna dichiarazione → null');
}
{
  // detectWebmcp: rilevazione testuale sull'HTML renderizzato.
  ok(detectWebmcp('<script>document.modelContext.registerTool({})</script>') === 'document.modelContext', 'WebMCP: API corrente rilevata');
  ok(detectWebmcp('<script>navigator.modelContext.registerTool({})</script>') === 'navigator.modelContext', 'WebMCP: API deprecata rilevata');
  ok(detectWebmcp('<p>parliamo di modelContext in un articolo</p>') === null, 'WebMCP: la parola nel testo non è una registrazione');
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
      structured: { score: 80, checks: [] }, readability: { score: 50, checks: [] }, answerability: { score: 70, checks: [] },
      offsite: { score: 100, checks: [] },
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
  ok(partial.includes('PageSpeed non disponibile') && !partial.includes('chiave PSI'), 'suite html: performance assente degrada con nota neutra');
  ok(md.includes('## Performance — 91/100 (Lighthouse · mobile)'), 'suite md: intestazione Performance indica la strategia');

  // fix round 2: gemello di normalize() usato da suiteReport.js — un suite.geo con
  // cinque categorie (client vecchio, come nel finding 4 di report.js) non deve
  // stampare "null" ne' colorare di rosso una categoria mai misurata.
  const fiveCatGeo = { host: 'z.com', url: 'https://z.com/', overall: 50, categories: {
    access: { score: 100, checks: [] }, agentFiles: { score: 60, checks: [] }, structured: { score: 80, checks: [] },
    readability: { score: 50, checks: [] }, offsite: { score: 100, checks: [] },
  } };
  const suite5 = { ...suite, geo: fiveCatGeo };
  const html5 = toHtmlSuite(suite5, {});
  ok(!html5.includes('>null<') && !html5.includes('null%'), 'suite html: categoria assente non stampa "null"');
  const md5 = toMarkdownSuite(suite5, {});
  ok(md5.includes('Risposta pronta per le AI: —'), 'suite md: categoria assente mostra un trattino, non "undefined/100"');
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

// history: un cambio di profilo pesi non è un cambio del sito. Il delta GEO sparisce.
{
  const base = { host: 'x.com', url: 'https://x.com/', geo: { overall: 80, profile: 'EVIDENCE-2026' }, a11y: { result: { score: 60 }, axe: { ok: true, counts: { violations: 3 } } }, perf: { ok: true, result: { score: 90 } } };
  const s = snapshot(base, '2026-08-04T00:00:00Z');
  ok(s.profile === 'EVIDENCE-2026', 'history: il profilo pesi entra nello snapshot');

  const stessoProfilo = diff({ geo: 70, a11y: 50, axe: 8, perf: 85, profile: 'EVIDENCE-2026' }, s);
  ok(stessoProfilo.geo === 10 && !stessoProfilo.profileChanged, 'history: stesso profilo → delta GEO calcolato');

  const altroProfilo = diff({ geo: 70, a11y: 50, axe: 8, perf: 85, profile: 'BEACON' }, s);
  ok(altroProfilo.profileChanged && altroProfilo.profileChanged.prev === 'BEACON', 'history: profilo diverso segnalato');
  ok(altroProfilo.geo === undefined, 'history: profilo diverso → nessun delta GEO (non sarebbe confrontabile)');
  ok(altroProfilo.a11y === 10 && altroProfilo.perf === 5, 'history: accessibilità e performance restano confrontabili (non dipendono dai pesi GEO)');

  // Storico vecchio senza il campo: si assume il profilo precedente, non si mente.
  const vecchio = diff({ geo: 70, a11y: 50, axe: 8, perf: 85 }, s);
  ok(vecchio.profileChanged && vecchio.profileChanged.prev === null, 'history: snapshot pre-profilo trattato come profilo diverso');

  // GEO fallita nella scansione attuale: profilo null, ma non c'è un delta da sospendere.
  const geoFallita = diff({ geo: 70, a11y: 50, axe: 8, perf: 85, profile: 'EVIDENCE-2026' }, { geo: null, a11y: 60, axe: 5, perf: 90, profile: null });
  ok(!geoFallita.profileChanged && geoFallita.a11y === 10, 'history: GEO fallita → nessun avviso di cambio profilo');
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
        'server-response-time': { title: 'Tempo di risposta breve', score: 1, details: { type: 'opportunity', overallSavingsMs: 5 } },
      },
    },
    loadingExperience: { overall_category: 'FAST' },
  });
  ok(s.score === 92, 'psi: score = 92 (Lighthouse >90 → verde): ' + s.score);
  ok(s.metrics.find((m) => m.id === 'largest-contentful-paint').status === 'good', 'psi: LCP 2.1s → good');
  ok(s.metrics.find((m) => m.id === 'cumulative-layout-shift').status === 'crit', 'psi: CLS 0.3 → crit');
  ok(s.opportunities[0].savingsMs === 800, 'psi: opportunità estratta e ordinata');
  ok(!s.opportunities.some((o) => o.title === 'Tempo di risposta breve'), 'psi: audit già superato (score 1) escluso dalle opportunità');
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

// crawl.js — aggregazione: site-level dalla home, page-level mediate; answerability è
// page-level e può essere unmeasured su singole pagine (esce dalla media, non vale 0)
{
  const home = { url: 'https://x.com/', categories: { access: { score: 100 }, agentFiles: { score: 60 }, structured: { score: 80 }, readability: { score: 40 }, offsite: { score: 100 }, answerability: { score: 50 } } };
  const pages = [{ structured: 60, readability: 80, answerability: 70 }, { structured: 40, readability: 60, answerability: null }];
  const w = { access: 0.18, agentFiles: 0.05, structured: 0.15, readability: 0.22, offsite: 0.15, answerability: 0.25 };
  const a = aggregate(home, pages, w);
  ok(a.categories.access === 100, 'access resta site-level (home)');
  ok(a.categories.structured === 60, 'structured = media(80,60,40)=60: ' + a.categories.structured);
  ok(a.categories.readability === 60, 'readability = media(40,80,60)=60: ' + a.categories.readability);
  ok(a.categories.answerability === 60, 'answerability = media(50,70) ignorando la pagina non misurata: ' + a.categories.answerability);
  ok(a.overall > 0 && a.overall <= 100, 'overall di sito nel range con sei categorie: ' + a.overall);

  // Tutte le pagine non misurate: la categoria esce dal denominatore, non vale 0.
  const soloBrevi = aggregate({ url: 'https://x.com/', categories: { access: { score: 100 }, agentFiles: { score: 100 }, structured: { score: 100 }, readability: { score: 100 }, offsite: { score: 100 }, answerability: { score: 0, unmeasured: true } } }, [], w);
  ok(soloBrevi.overall === 100, 'answerability tutta non misurata esce dalla media (atteso 100, avuto ' + soloBrevi.overall + ')');

  // fix round 1: un modulo site-level unmeasured (es. offsite quando Common Crawl e' giu)
  // deve uscire dalla media come null, non entrare a punteggio pieno (allineato ad audit.js).
  const offsiteGiu = aggregate({ url: 'https://x.com/', categories: { access: { score: 100 }, agentFiles: { score: 100 }, structured: { score: 100 }, readability: { score: 100 }, answerability: { score: 100 }, offsite: { score: 60, unmeasured: true } } }, [], w);
  ok(offsiteGiu.categories.offsite === null, 'offsite unmeasured esce come null, non 60: ' + offsiteGiu.categories.offsite);
  ok(offsiteGiu.overall === 100, 'offsite unmeasured esclusa dal peso (atteso 100, avuto ' + offsiteGiu.overall + ')');
}

// audit.js — answerability è fra le categorie pesate e il profilo viaggia nel risultato
{
  ok(Object.keys(CATEGORY_LABELS).includes('answerability'), 'audit: answerability è fra le categorie pesate');
  ok(Object.keys(CATEGORY_LABELS).length === 6, 'audit: sei categorie pesate (avute ' + Object.keys(CATEGORY_LABELS).length + ')');
}

// report.js — export MD/HTML (funzioni pure)
{
  const fake = { host: 'x.com', url: 'https://x.com/', overall: 72, categories: {
    access: { score: 100, checks: [] },
    agentFiles: { score: 60, checks: [{ fix: 'aggiungi llms.txt' }] },
    structured: { score: 80, checks: [] },
    readability: { score: 50, checks: [] },
    answerability: { score: 70, checks: [] },
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

  // fix round 1: payload con una categoria mancante (client con stato vecchio, pre-answerability)
  // non deve lanciare - la chiave assente diventa null, come una categoria non misurata.
  const fiveCats = { host: 'z.com', url: 'https://z.com/', overall: 50, categories: {
    access: { score: 100, checks: [] }, agentFiles: { score: 60, checks: [] }, structured: { score: 80, checks: [] },
    readability: { score: 50, checks: [] }, offsite: { score: 100, checks: [] },
  } };
  const nm5 = normalize(fiveCats);
  ok(nm5.scores.answerability === null, 'normalize: categoria assente diventa null, non lancia: ' + nm5.scores.answerability);
  const md5 = toMarkdown(fiveCats);
  ok(md5.includes('| — | —'), 'markdown: categoria non misurata mostra un trattino, non "undefined/100"');
  const html5 = toHtml(fiveCats);
  ok(!html5.includes('undefined'), 'html: categoria non misurata non stampa "undefined"');
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
  ok(msg('en', 'access.training.detail', { allowed: 3, total: 5 }) === '3/5 allowed in robots.txt', 'i18n: interpolazione {parametri}');
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
  // Stesso controllo per de fr es pt (prima solo en): il questionario, i testi fissi della
  // pagina AI Act e le descrizioni FEATURES della home devono avere voce in ogni lingua,
  // diversa dall'italiano. Le stringhe fisse si leggono dal sorgente: un t('…') nuovo
  // senza traduzione fa fallire il test invece di mostrare italiano sul sito tedesco.
  {
    const pagina = fs.readFileSync('./web/app/aiact/page.jsx', 'utf8') + fs.readFileSync('./web/app/page.jsx', 'utf8').split('function Gauge')[0];
    const fisse = [...pagina.matchAll(/\bt\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")\s*\)/g)].map((m) => (m[1] ?? m[2]).replace(/\\'/g, "'"));
    const features = [...pagina.matchAll(/\b[td]: '((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\'/g, "'"));
    const tutte = [...new Set([...fisse, ...features, ...Object.values(QUESTION_TEXT).flatMap((q) => [q.q, q.help, q.detail, ...(q.examples || []), ...Object.values(q.options || {})])].filter(Boolean))];
    ok(tutte.length > 120, `aiact+home/ui: stringhe estratte (${tutte.length})`);
    const UI5 = { en, de: UI_DE, fr: UI_FR, es: UI_ES, pt: UI_PT };
    for (const [l, d] of Object.entries(UI5)) {
      const manca = tutte.filter((k) => !d[k]);
      ok(manca.length === 0, `aiact+home/ui: ${l} traduce ogni stringa (mancanti: ${manca.length}, es. ${manca.slice(0, 2).join(' | ')})`);
      const uguali = tutte.filter((k) => d[k] === k && k.length > 25);
      ok(uguali.length === 0, `aiact+home/ui: ${l} senza testi lunghi copiati dall'italiano (${uguali.slice(0, 2).join(' | ')})`);
    }
    // Il perché di ogni obbligo (era fisso in italiano dentro deriveObligations) esce nella lingua richiesta.
    const tutti = { role: 'both', interaction: true, syntheticContent: true, deepfake: true, editorialReview: false, gpai: true };
    const whyIt = assessAiAct(tutti, null, 'it').obligations.map((o) => o.why);
    ok(whyIt.length >= 6 && whyIt.every(Boolean), 'aiact/why: ogni obbligo ha un perché in it');
    for (const l of ['en', 'de', 'fr', 'es', 'pt']) {
      const w = assessAiAct(tutti, null, l).obligations.map((o) => o.why);
      ok(w.every((x, i) => x && x !== whyIt[i]), `aiact/why: perché tradotto in ${l} (${w.find((x, i) => x === whyIt[i]) || 'tutti'})`);
    }
    const scanWhy = assessAiAct({ role: 'none' }, { chatbots: ['Tidio'] }, 'de').obligations.find((o) => o.id === 'art50_1').why;
    ok(scanWhy.includes('Tidio') && !scanWhy.includes('scansione'), `aiact/why: dettaglio scan interpolato in de («${scanWhy}»)`);
  }
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
  // è stato scritto) da «sito che non risponde» (424): senza il flag la route
  // non può scegliere, e ha risposto 200 «nessun segnale» a un file:// bloccato.
  ok(r.blocked === true, 'ssrf/retry: il blocco è marcato `blocked` per chi chiama');
  // Un nome inesistente: l'esito dipende dal resolver, non dal codice, e va
  // asserito di conseguenza. Il resolver dell'hosting di produzione risponde con
  // un IP pubblico anche a `.invalid` (NXDOMAIN dirottato dal provider): lì il
  // guard deve lasciar passare — l'IP è pubblico, non c'è nulla da bloccare — e
  // il caso diventa «il sito non risponde». Con un resolver onesto è invece
  // l'indirizzo a essere sbagliato, quindi `blocked`. Asserire un solo esito
  // renderebbe il test una bugia in metà degli ambienti.
  const nomeFinto = 'esempio-che-non-esiste-mai.invalid';
  const risolve = await (await import('node:dns/promises')).lookup(nomeFinto).then(() => true, () => false);
  const dns = await fetchText('http://' + nomeFinto + '/', { timeout: 4000, retries: 0 });
  ok(dns.ok === false, 'ssrf/retry: nome inesistente = fetch fallita');
  ok(dns.blocked === (risolve ? undefined : true), `ssrf/retry: blocked coerente col resolver (risolve=${risolve})`);

  // Il motivo del blocco deve poter essere ridetto nella lingua dell'utente:
  // `error` è italiano per costruzione (log e CLI), quindi accanto viaggia una
  // chiave i18n. Se il code manca, o se la chiave non esiste nel catalogo, il
  // messaggio inglese resterebbe mezzo italiano: proprio il difetto trovato in
  // produzione («That address cannot be scanned: IP interno non consentito»).
  ok(r.errorCode === 'ssrf.internalIp' && r.errorDetail === '127.0.0.1', `ssrf/i18n: code e detail arrivano a chi chiama (${r.errorCode}/${r.errorDetail})`);
  const casi = [
    ['not-a-url', 'ssrf.badUrl'],
    ['file:///etc/passwd', 'ssrf.scheme'],
    ['http://127.0.0.1/', 'ssrf.internalIp'],
    ['http://qualcosa.internal/', 'ssrf.internalHost'],
  ];
  for (const [raw, code] of casi) {
    const e = await assertSafeUrl(raw).then(() => null, (err) => err);
    ok(e && e.code === code, `ssrf/i18n: ${raw} → code ${code} (${e && e.code})`);
  }
  // Ogni code del guard tradotto in italiano E in inglese, con il `{detail}`
  // sostituito: una chiave mancante ricadrebbe sull'italiano senza farsi notare.
  const tuttiCode = ['ssrf.badUrl', 'ssrf.scheme', 'ssrf.noHost', 'ssrf.internalIp', 'ssrf.internalHost', 'ssrf.dnsFail', 'ssrf.dnsEmpty', 'ssrf.resolvesInternal', 'ssrf.redirects'];
  const senzaChiave = tuttiCode.filter((c) => {
    const it = msg('it', c, { detail: 'X' });
    const en = msg('en', c, { detail: 'X' });
    return it === c || en === c || it === en || /\{detail\}/.test(it + en);
  });
  ok(senzaChiave.length === 0, `ssrf/i18n: ogni motivo tradotto in it e en (mancanti: ${senzaChiave.join(',') || 'nessuno'})`);
}

// ── i18n degli errori: catalogo completo e nessun testo di Node all'utente ───
// Gli assert sullo status code non bastano: un 400 col motivo in italiano dentro
// una frase inglese passa tutti i controlli di status e resta sbagliato. Qui si
// verifica il testo, non il codice.
{
  const casiUrl = [
    ['', 'url.missing'],
    [42, 'url.missing'],
    ['ftp://esempio.ch/', 'url.scheme'],
    ['http://', 'url.invalid'],
    ['intranet', 'url.noDomain'],
  ];
  for (const [raw, code] of casiUrl) {
    let e = null;
    try { normUrl(raw); } catch (err) { e = err; }
    ok(e && e.badUrl === true && e.code === code, `url/i18n: ${JSON.stringify(raw)} → code ${code} (${e && e.code})`);
  }

  // Ogni chiave usata nel codice deve esistere in it E in en, essere diversa fra
  // le due lingue (una traduzione copiata dall'italiano è una traduzione mancante)
  // e non lasciare `{detail}` scoperto quando il parametro c'è.
  const sorgenti = [
    'src/guard.js', 'src/lib.js', 'src/ssrf-guard.js', 'src/aiact.js',
    'web/app/api/http.js',
    ...fs.readdirSync('web/app/api', { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => `web/app/api/${d.name}/route.js`),
  ];
  const usate = new Set();
  for (const f of sorgenti) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/'((?:api|url|ssrf)\.[a-zA-Z.]+)'/g)) usate.add(m[1]);
  }
  ok(usate.size >= 20, `i18n: chiavi di errore trovate nel codice (${usate.size})`);
  const rotte = [...usate].filter((k) => {
    const i = msg('it', k, { detail: 'X' });
    const e = msg('en', k, { detail: 'X' });
    return i === k || e === k || i === e || /\{detail\}/.test(i + e);
  });
  ok(rotte.length === 0, `i18n: ogni chiave di errore tradotta in it e en (rotte: ${rotte.join(',') || 'nessuna'})`);

  // Le sei lingue, non due. `msg()` ripiega sull'italiano quando la chiave manca:
  // un utente tedesco leggeva «IP interno non consentito» e nessun test se ne
  // accorgeva, perché una stringa c'era. Si confrontano gli INSIEMI di chiavi.
  for (const lang of ['de', 'fr', 'es', 'pt']) {
    const mancanti = [...usate].filter((k) => msg(lang, k, { detail: 'X' }) === msg('it', k, { detail: 'X' }));
    ok(mancanti.length === 0, `i18n ${lang}: ogni errore tradotto (uguali all'italiano: ${mancanti.join(',') || 'nessuno'})`);
  }

  // Catalogo completo, non solo gli errori: `msg()` ripiega sull'italiano per
  // QUALSIASI chiave mancante, quindi il modulo AI Act mostrava testo italiano
  // dentro l'interfaccia tedesca senza che nulla lanciasse. Si confrontano gli
  // insiemi di chiavi, non i testi: due lingue possono legittimamente coincidere
  // su una sigla, non possono avere cataloghi di dimensione diversa.
  const dizionari = {};
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'pt']) {
    dizionari[lang] = Object.keys(JSON.parse(JSON.stringify(DIZ[lang])));
  }
  for (const lang of ['en', 'de', 'fr', 'es', 'pt']) {
    const buchi = dizionari.it.filter((k) => !dizionari[lang].includes(k));
    ok(buchi.length === 0, `catalogo ${lang}: nessuna chiave mancante rispetto all'italiano (${buchi.length ? buchi.slice(0, 5).join(',') + '…' : 'nessuna'})`);
  }
  // Chiave presente ma testo italiano copiato: answerability e agentReady sono arrivati
  // così in 5 lingue senza che il controllo sulle chiavi se ne accorgesse.
  // Ammessi uguali all'italiano solo sigle, codice (remedy.*) e parole identiche nella lingua.
  const UGUALI_OK = /^(remedy\.|axe\.nd$|suite\.card\.nd$|report\.date$|structured\.(meta\.name|signals\.detail)$|rights\.(signal\.name|tdmrep\.name|tdmrep\.detail\.ok)$|tech\.(https\.name|status\.detail\.ok|viewport\.name|viewport\.detail\.ok|canonical\.name|hreflang\.name|og\.name)$|a11y\.headings\.detail$|agentFiles\.llms\.detail\.ok$|agentReady\.(usage|botauth)\.name$)/;
  for (const lang of ['en', 'de', 'fr', 'es', 'pt']) {
    const copiati = dizionari.it.filter((k) => !UGUALI_OK.test(k) && DIZ[lang][k] === DIZ_IT[k]);
    ok(copiati.length === 0, `catalogo ${lang}: nessun testo copiato dall'italiano (${copiati.slice(0, 5).join(',') || 'nessuno'})`);
  }

  // errorText: col code traduce, senza code NON restituisce il messaggio originale.
  // È la regola di sicurezza dell'impianto: il testo di Node nomina l'infrastruttura
  // («connect ECONNREFUSED 10.0.0.5:443», path assoluti) e la risposta HTTP è pubblica.
  const conCode = errorText('en', { code: 'ssrf.internalIp', detail: '127.0.0.1' });
  ok(/internal/i.test(conCode) && conCode.includes('127.0.0.1'), `errorText: code tradotto in en (${conCode})`);
  ok(errorText('it', { code: 'ssrf.internalIp', detail: '127.0.0.1' }) !== conCode, 'errorText: it ed en differiscono');
  const nudo = new Error('connect ECONNREFUSED 10.0.0.5:443');
  ok(errorText('en', nudo) === '', 'errorText: eccezione senza code → stringa vuota');
  ok(!errorText('en', nudo).includes('10.0.0.5'), 'errorText: nessun IP interno nel testo restituito');
  ok(errorText('it', { code: 'chiave.inesistente' }) === '', 'errorText: code fuori catalogo → stringa vuota');
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

// report/ui: ogni t('…') letterale di /report ha la voce nei 5 dizionari. La chiave è la
// stringa italiana: senza voce, il sito inglese mostra l'italiano e nessun errore lo segnala.
{
  const src = ['./web/app/report/page.jsx', './web/app/report/riga.mjs', './web/app/geo-dettaglio.jsx', './web/app/page.jsx'].map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const chiavi = [...src.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\'/g, "'"));
  ok(chiavi.length > 20, `report/ui: chiavi t() estratte (${chiavi.length})`);
  const diz = { en, de: UI_DE, fr: UI_FR, es: UI_ES, pt: UI_PT };
  const mancanti = Object.entries(diz).flatMap(([l, d]) => chiavi.filter((k) => !d[k]).map((k) => l + ': ' + k));
  ok(mancanti.length === 0, `report/ui: ogni t('…') tradotto in en de fr es pt (mancanti: ${mancanti.slice(0, 4).join(' | ')})`);
  // le etichette di categoria passano da t(LABELS[k]): dinamiche, la regex sopra non le vede
  for (const f of ['./web/app/geo-dettaglio.jsx']) {
    const blocco = (fs.readFileSync(f, 'utf8').match(/const LABELS = \{([^}]*)\}/) || [])[1] || '';
    const etichette = [...blocco.matchAll(/:\s*'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]);
    ok(etichette.length === 6, `report/ui: ${f} ha 6 etichette LABELS (${etichette.length})`);
    const senza = Object.entries(diz).flatMap(([l, d]) => etichette.filter((k) => !d[k]).map((k) => l + ': ' + k));
    ok(senza.length === 0, `report/ui: etichette LABELS di ${f} tradotte (mancanti: ${senza.slice(0, 4).join(' | ')})`);
  }
}

// report/riga: la riga sotto ogni categoria GEO deve spiegare il voto, anche quando a
// toglierlo è un controllo informativo (off-site 60/100 con CCBot ok e sito fuori da Common Crawl)
{
  const id = (s) => s;
  const offsite = rigaCategoria([{ name: 'CCBot', status: 'good' }, { name: 'Presenza in Common Crawl', status: 'info' }], id);
  ok(offsite.includes('Presenza in Common Crawl'), `report/riga: off-site nomina il controllo informativo che pesa sul 60 («${offsite}»)`);
  ok(offsite.startsWith('1/1 controlli ok'), `report/riga: conteggio solo sui non-informativi («${offsite}»)`);
  const soloInfo = rigaCategoria([{ name: 'Non misurato', status: 'info' }], id);
  ok(!soloInfo.includes('0/0') && soloInfo.includes('Non misurato'), `report/riga: categoria solo-info senza «0/0» e con il nome («${soloInfo}»)`);
  const misto = rigaCategoria([{ name: 'A', status: 'good' }, { name: 'B', status: 'warn' }, { name: 'C', status: 'crit' }], id);
  ok(misto === '1/3 controlli ok · B, C', `report/riga: problemi elencati dopo il conteggio («${misto}»)`);
}

// home: il dettaglio per categoria viene dagli stessi componenti di /report (un solo file, due pagine)
{
  const home = fs.readFileSync('./web/app/page.jsx', 'utf8');
  const rep = fs.readFileSync('./web/app/report/page.jsx', 'utf8');
  for (const [nome, src] of [['home', home], ['report', rep]]) {
    ok(/from '(\.\/|\.\.\/)geo-dettaglio'/.test(src) && src.includes('CategoriaGeo') && src.includes('DaSistemare'), `${nome}: usa CategoriaGeo e DaSistemare condivisi`);
    ok(!/const LABELS = \{/.test(src), `${nome}: niente copia locale di LABELS`);
  }
  ok(home.includes('res.agentReady') && home.includes("t(\"Standard d'avanguardia per gli agenti\")"), 'home: mostra agentReady come sezione informativa');
  const ar = analyzeAgentReady({}, 'it');
  ok(ar.informational === true, 'agentReady: informativo nel motore (la home non lo mette tra le categorie col punteggio)');
}

// rifiniture /report (minori della review finale)
{
  const src = fs.readFileSync('./web/app/report/page.jsx', 'utf8');
  // PSI fallisce per quota/timeout anche CON la chiave: la nota non deve dare la colpa alla chiave
  ok(!src.includes("t('chiave PSI mancante')") && src.includes("t('PageSpeed non disponibile')"), 'report: nota PSI neutra');
  // sotto i 240 px utili (zoom 200%) la griglia non deve sbordare
  ok(src.includes('minmax(min(240px, 100%), 1fr)'), 'report: griglia senza overflow sotto 240 px');
  // lo storico è solo mobile: con lo switch su Computer la riga delta deve dirlo
  ok(src.includes("label={`Performance (${t('Dispositivi mobili')})`}"), 'report: delta Performance etichettata mobile');
  // catalogo motore: la categoria answerability era rimasta in italiano in 5 lingue
  const UI = { en, de: UI_DE, fr: UI_FR, es: UI_ES, pt: UI_PT };
  for (const [l, d] of Object.entries(UI)) {
    ok(msg(l, 'category.answerability') === d['Risposta pronta per le AI'], `i18n motore: category.answerability tradotta in ${l} («${msg(l, 'category.answerability')}»)`);
  }
}

// auditAll: con strategy 'desktop' la PSI desktop c'è già, niente seconda chiamata identica.
// Rete spenta: fetch stub conta solo le chiamate PSI; 127.0.0.1 ferma GEO e a11y al guard SSRF.
{
  const realFetch = globalThis.fetch;
  const psi = [];
  globalThis.fetch = async (u) => {
    if (String(u).includes('pagespeedonline')) psi.push(new URL(u).searchParams.get('strategy'));
    throw new Error('rete spenta nel test');
  };
  try {
    const r = await auditAll('http://127.0.0.1/', { strategy: 'desktop', desktop: true });
    ok(psi.join(',') === 'desktop', `suite: strategy desktop fa UNA chiamata PSI (${psi.join(',')})`);
    ok(r.perfDesktop === r.perf, 'suite: perfDesktop riusa perf quando la strategia è già desktop');
    psi.length = 0;
    const m = await auditAll('http://127.0.0.1/', { desktop: true });
    ok(psi.sort().join(',') === 'desktop,mobile' && m.perfDesktop && m.perfDesktop.strategy === 'desktop', `suite: mobile + desktop in parallelo (${psi.join(',')})`);
  } finally { globalThis.fetch = realFetch; }
}

// anti-DNS-rebinding: lookup dentro la connessione + pinnedFetch (offline, resolver finto)
{
  const cbLookup = (look, host, opts) => new Promise((res) => look(host, opts, (e, a, f) => res({ e, a, f })));
  const fake = (addrs) => makeSafeLookup(async () => addrs);
  for (const [name, addr, fam] of [['127.0.0.1', '127.0.0.1', 4], ['::1', '::1', 6], ['metadata', '169.254.169.254', 4]]) {
    const r = await cbLookup(fake([{ address: addr, family: fam }]), 'x.test', {});
    ok(r.e instanceof SsrfError && r.e.code === 'ssrf.resolvesInternal', `rebind: lookup blocca ${name}`);
  }
  const mix = await cbLookup(fake([{ address: '8.8.8.8', family: 4 }, { address: '10.0.0.1', family: 4 }]), 'x.test', { all: true });
  ok(mix.e instanceof SsrfError && mix.e.code === 'ssrf.resolvesInternal', 'rebind: misto pubblico+privato bloccato');
  const pub = await cbLookup(fake([{ address: '8.8.8.8', family: 4 }]), 'x.test', {});
  ok(!pub.e && pub.a === '8.8.8.8' && pub.f === 4, 'rebind: IP pubblico passa (firma senza all)');
  const pubAll = await cbLookup(fake([{ address: '8.8.8.8', family: 4 }]), 'x.test', { all: true });
  ok(!pubAll.e && pubAll.a.length === 1 && pubAll.a[0].address === '8.8.8.8', 'rebind: IP pubblico passa (firma con all)');

  let hits = 0;
  let srvClose = () => {};
  const srv = http.createServer((req, res) => {
    hits++;
    req.socket.on('close', () => srvClose(true));
    if (req.url === '/gz') { res.writeHead(200, { 'content-encoding': 'gzip', 'set-cookie': ['a=1', 'b=2'], 'content-type': 'text/plain' }); res.end(zlib.gzipSync('ciao gzip')); }
    else if (req.url === '/slow') { res.writeHead(200, { 'content-encoding': 'gzip' }); const z = zlib.createGzip(); z.pipe(res); z.write('x'.repeat(1000)); z.flush(); }
    else if (req.url === '/204') { res.writeHead(204); res.end(); }
    else if (req.url === '/301') { res.writeHead(301, { location: '/dest' }); res.end(); }
    else { res.end('ok'); }
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  // lookup di test: nessun guard, punta sempre a 127.0.0.1
  const open = (h, o, cb) => (o.all ? cb(null, [{ address: '127.0.0.1', family: 4 }]) : cb(null, '127.0.0.1', 4));
  try {
    // simulazione rebinding: 1ª risoluzione pubblica (controllo), poi 127.0.0.1 (connessione)
    let calls = 0;
    __setResolverForTests(async () => (++calls === 1 ? [{ address: '8.8.8.8', family: 4 }] : [{ address: '127.0.0.1', family: 4 }]));
    let err;
    try { await safeFetch(`http://rebind.test:${port}/`); } catch (e) { err = e; }
    ok(err instanceof SsrfError && err.code === 'ssrf.resolvesInternal', 'rebind: safeFetch lancia SsrfError al rebinding');
    ok(hits === 0 && calls === 2, `rebind: il server riceve 0 connessioni (hits=${hits}, risoluzioni=${calls})`);
    __setResolverForTests();

    // conversione risposta, senza guard
    const g = await pinnedFetch(`http://x.test:${port}/gz`, { _lookup: open });
    ok(g.status === 200 && (await g.text()) === 'ciao gzip', 'pinnedFetch: corpo gzip decompresso');
    ok(g.headers.getSetCookie().length === 2 && !g.headers.has('content-encoding'), 'pinnedFetch: header multipli preservati');
    // cancel del corpo gzip: il socket lato server deve chiudersi entro 1 s
    const closed = new Promise((r) => { srvClose = r; });
    const big = await pinnedFetch(`http://x.test:${port}/slow`, { _lookup: open });
    const rd = big.body.getReader();
    await rd.read();
    await rd.cancel();
    ok(await Promise.race([closed, new Promise((r) => setTimeout(() => r(false), 1000))]) === true, 'pinnedFetch: cancel su gzip chiude il socket lato server');
    const n = await pinnedFetch(`http://x.test:${port}/204`, { _lookup: open });
    ok(n.status === 204 && n.body === null, 'pinnedFetch: 204 con corpo null');
    const m = await pinnedFetch(`http://x.test:${port}/301`, { redirect: 'manual', _lookup: open });
    ok(m.status === 301 && m.headers.get('location') === '/dest', 'pinnedFetch: 301 con Location leggibile, nessun redirect seguito');
  } finally { __setResolverForTests(); srv.close(); }
}
{
  // Status line ostile (carattere di controllo nel reason phrase): il sito scansionato NON deve
  // poter far cadere il processo con un'eccezione non catturata nel callback 'response'.
  const net = await import('node:net');
  const raw = net.createServer((s) => s.once('data', () => s.end('HTTP/1.1 200 O\x01K\r\nContent-Length: 2\r\n\r\nhi')));
  await new Promise((r) => raw.listen(0, '127.0.0.1', r));
  const loop = (h, o, cb) => { if (typeof o === 'function') { cb = o; o = {}; } o.all ? cb(null, [{ address: '127.0.0.1', family: 4 }]) : cb(null, '127.0.0.1', 4); };
  try {
    const r = await pinnedFetch(`http://x.test:${raw.address().port}/`, { _lookup: loop }).catch(() => null);
    ok(r === null || (r.status === 200 && (await r.text()) === 'hi'), 'pinnedFetch: status text ostile gestito, nessun crash del processo');
  } finally { raw.close(); }
}

// switch Dispositivo condiviso: /report lo etichetta «Performance:», /perf lo usa con UNA richiesta
{
  const sw = fs.existsSync('./web/app/device-switch.jsx') ? fs.readFileSync('./web/app/device-switch.jsx', 'utf8') : '';
  ok(sw.includes('aria-pressed') && sw.includes("t('Dispositivi mobili')") && sw.includes("t('Computer')"), 'device-switch: componente condiviso con aria-pressed');
  const rep = fs.readFileSync('./web/app/report/page.jsx', 'utf8');
  ok(rep.includes('<DeviceSwitch label="Performance:"') && !rep.includes('aria-pressed'), 'report: switch condiviso etichettato «Performance:»');
  const perf = fs.readFileSync('./web/app/perf/page.jsx', 'utf8');
  ok(perf.includes('<DeviceSwitch') && perf.includes('desktop: true') && !perf.includes('Analizza come desktop'), 'perf: switch mobile/desktop al posto della casella');
  const route = fs.readFileSync('./web/app/api/perf/route.js', 'utf8');
  ok(route.includes('auditPerfPair') && route.includes('desktop === true'), 'api/perf: desktop:true misura le due strategie');
  for (const [l, d] of Object.entries({ en, de: UI_DE, fr: UI_FR, es: UI_ES, pt: UI_PT })) {
    ok(!('Analizza come desktop (default: mobile)' in d), `i18n ${l}: chiave morta della casella desktop rimossa`);
    ok(d['dati reali utenti:'], `i18n ${l}: «dati reali utenti:» tradotto`);
  }
}

// auditPerfPair: mobile + desktop in parallelo (il token Turnstile è monouso: una richiesta, due misure)
{
  const { auditPerfPair } = await import('./src/perf.js');
  ok(typeof auditPerfPair === 'function', 'perf: auditPerfPair esportata');
  const realFetch = globalThis.fetch;
  const psi = [];
  globalThis.fetch = async (u) => {
    if (String(u).includes('pagespeedonline')) psi.push(new URL(u).searchParams.get('strategy'));
    throw new Error('rete spenta nel test');
  };
  try {
    const r = await auditPerfPair('https://example.com/', { lang: 'it' });
    ok(psi.sort().join(',') === 'desktop,mobile', `perf: coppia = due chiamate PSI (${psi.join(',')})`);
    ok(r.strategy === 'mobile' && r.desktop && r.desktop.strategy === 'desktop', 'perf: risposta mobile con campo desktop');
  } finally { globalThis.fetch = realFetch; }
}

// WCAG 2.2 su /a11y e /report; disclaimer con il dato Deque e la fonte
{
  ok(fs.readFileSync('./src/render.js', 'utf8').includes("'wcag22aa'"), 'axe: runOnly include wcag22aa (target-size, 2.5.8)');
  for (const f of ['./web/app/a11y/page.jsx', './web/app/report/page.jsx']) ok(!fs.readFileSync(f, 'utf8').includes('WCAG 2.1'), `${f}: niente WCAG 2.1 residuo`);
  const a11y = fs.readFileSync('./web/app/a11y/page.jsx', 'utf8');
  ok(a11y.includes('https://www.deque.com/blog/automated-testing-study-identifies-57-percent-of-digital-accessibility-issues/'), 'a11y: disclaimer cita la fonte Deque');
  ok(!a11y.includes('~metà dei criteri') && !a11y.includes('~50% dei criteri'), 'a11y: niente stima sbagliata sui criteri');
  const nuove = [
    'Analisi approfondita con axe-core (pagina renderizzata: contrasto reale, ARIA, dimensione dei target)',
    'Anche con axe-core i test automatici trovano poco più della metà dei problemi reali: il 57% in uno studio su oltre 2.000 audit',
    'Da verificare a mano:',
    'navigazione completa con la sola tastiera (Tab, Invio, Esc)',
    'ordine logico del focus, sempre visibile',
    'lettura con uno screen reader (NVDA, VoiceOver)',
    'zoom al 200% senza perdere contenuti',
    "testi alternativi che descrivono davvero l'immagine",
  ];
  for (const k of nuove) ok(a11y.includes(k.replace(/'/g, "\\'")) || a11y.includes(k), `a11y: usa «${k.slice(0, 40)}…»`);
  for (const [l, d] of Object.entries({ en, de: UI_DE, fr: UI_FR, es: UI_ES, pt: UI_PT })) {
    for (const k of nuove) ok(d[k], `i18n ${l}: «${k.slice(0, 40)}…» tradotta`);
    ok(!Object.keys(d).some((k) => k.includes('WCAG 2.1')), `i18n ${l}: nessuna chiave WCAG 2.1 residua`);
  }
}

console.log(`\x1b[32m✓ ${n} assert passati\x1b[0m`);

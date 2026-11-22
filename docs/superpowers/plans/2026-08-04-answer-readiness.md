# Answer-readiness e profilo pesi EVIDENCE-2026 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** aggiungere a Beacon la misura di answer-readiness come sesta categoria pesata, una settima categoria informativa per gli standard d'avanguardia, e rifondare i pesi sull'evidenza empirica pubblicata (profilo `EVIDENCE-2026`).

**Architecture:** gli analizzatori di Beacon sono funzioni pure `(datiGiàRaccolti, lang) → { score, checks[] }` in `src/analyzers.js`; il parsing HTML sta in `src/lib.js` (regex, zero dipendenze); gli orchestratori (`audit.js`, `crawl.js`) raccolgono i dati di rete e sommano i punteggi con i pesi di `weights.mjs`. Il lavoro segue quella separazione: prima gli helper di parsing, poi gli analizzatori con i loro test, poi l'innesto negli orchestratori, per ultimo la resa (report, web, i18n).

**Tech Stack:** Node ≥18 ESM puro, **zero dipendenze runtime** (`package.json` → `dependencies: {}`), test con `node:assert/strict` in un unico `test.js` eseguito da `npm test`, front-end Next.js in `web/`.

**Spec:** `docs/superpowers/specs/2026-08-04-answer-readiness-design.md`

## Global Constraints

- **Zero dipendenze runtime.** Vietato aggiungere pacchetti: né `cheerio`, né `jsdom`, né librerie di NLP. Il parsing HTML resta su regex, come dichiarato in `src/lib.js:2-3`.
- **Analizzatori puri.** Nessuna chiamata di rete dentro `src/analyzers.js`: i dati arrivano già raccolti dall'orchestratore. È la proprietà che rende i test eseguibili senza rete.
- **Nessun LLM nel motore.** Tutte le euristiche sono deterministiche e riproducibili.
- **i18n a sei lingue.** `it` è la lingua base e il fallback (`src/messages/index.js:32`). Ogni chiave nuova in `src/messages/it.js` deve esistere anche in `en.js`, `de.js`, `fr.js`, `es.js`, `pt.js`, altrimenti il test di parità (`test.js:896-903`) fallisce.
- **Commenti in italiano**, come tutto il codice esistente.
- **`ponytail:` per i ceiling.** Ogni semplificazione con un limite noto (regex invece di DOM, euristica linguistica) porta un commento `ponytail:` che nomina il limite e la via d'uscita.
- **Mai attestazioni automatiche di conformità.** Un check che Beacon non può verificare dall'esterno lo dichiara nel testo (vale per Web Bot Auth, Task 6).
- **Pesi esatti del profilo EVIDENCE-2026** (somma 1.00): `answerability 0.25`, `readability 0.22`, `access 0.18`, `structured 0.15`, `offsite 0.15`, `agentFiles 0.05`.
- **Test:** `npm test` (`node test.js`) deve restare verde alla fine di ogni task. Il file `test.js` contiene byte non-UTF8 (accenti in latin1): **non modificarlo con grep/sed**, e leggerlo con `node -e "fs.readFileSync('test.js','latin1')"` quando serve ispezionarlo. Le modifiche si fanno con Edit su stringhe lette dal file.
- **Commit dopo ogni task**, messaggio in italiano, prefisso convenzionale (`feat:`, `refactor:`, `test:`, `docs:`), e in coda `Co-Authored-By: claude-flow <ruv@ruv.net>`.

---

## File Structure

| File | Responsabilità | Modifica |
|---|---|---|
| `weights.mjs` | pesi come modulo JS (sopravvive al bundling webpack) | profilo EVIDENCE-2026 + `PROFILE` |
| `weights.json` | documentazione dei pesi e dei profili storici | nuovi valori + fonti |
| `src/lib.js` | rete + parsing HTML puro | `stripTags`, `sections`, `extractableBlocks`, `paragraphWords`, `citableEvidence`, `htmlLang`; `headers` nel return di `fetchText` |
| `src/analyzers.js` | analizzatori puri + etichette categorie | `analyzeAnswerability`, `analyzeAgentReady`, `QUESTION_WORDS`, `isQuestionHeading`, `pageLang`; riscrittura di `analyzeAgentFiles` e del dettaglio di `analyzeAccess` |
| `audit.js` | orchestratore CLI (**due** funzioni: `audit()` e `auditHtmlSnapshot()`) | probe AIPREF/WebMCP, innesto answerability, `profile` nel return, stampa CLI |
| `crawl.js` | audit multi-pagina, `aggregate()` puro | answerability page-level |
| `src/history.js` | snapshot/diff puri | campo `profile` + guardia nel `diff()` |
| `src/report.js` | export Markdown/HTML | nota profilo nel footer |
| `src/messages/{it,en,de,fr,es,pt}.js` | catalogo messaggi del motore | ~45 chiavi nuove per lingua |
| `web/app/page.jsx` | UI del tool GEO | etichetta answerability, blocco `agentReady`, copy «sei categorie» |
| `web/app/translations/{en,de,fr,es,pt}.js` | copy UI (chiave = frase italiana) | frase «Sei categorie…» |
| `test.js` | unica suite | ~35 assert nuovi, falsi positivi per primi |

---

### Task 1: Profilo pesi EVIDENCE-2026 e campo `profile`

Il primo task cambia i pesi e fa viaggiare il nome del profilo fino al report e allo storico. Va per primo perché `answerability` può avere il suo peso in tabella prima di esistere come categoria: il denominatore `wsum` in `audit.js:88` somma solo i pesi delle categorie presenti in `CATEGORY_LABELS`, quindi il punteggio resta normalizzato e il repo resta verde a metà strada.

**Files:**
- Modify: `weights.mjs` (tutto il file)
- Modify: `weights.json` (tutto il file)
- Modify: `audit.js:108` e `audit.js:172-186` (campo `profile` nei due return)
- Modify: `src/report.js:34-50` e `src/report.js:52-92` (nota profilo nei footer)
- Test: `test.js`

**Interfaces:**
- Consumes: niente (primo task)
- Produces: `import WEIGHTS, { PROFILE } from './weights.mjs'` — `WEIGHTS` è `Record<string, number>` con le sei chiavi, `PROFILE` è la stringa `'EVIDENCE-2026'`. Il risultato di `audit()` e `auditHtmlSnapshot()` guadagna `profile: string`.

- [ ] **Step 1: Scrivere gli assert che falliscono**

In `test.js`, subito dopo il blocco `// robots.txt` (cioè dopo la riga `}` che chiude il blocco iniziato a riga 43), inserire:

```js
// weights.mjs — profilo EVIDENCE-2026: i pesi sono una dichiarazione pubblica, non un dettaglio interno
{
  const somma = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  ok(Math.abs(somma - 1) < 1e-9, 'pesi: la somma fa esattamente 1.00 (avuta ' + somma + ')');
  ok(PROFILE === 'EVIDENCE-2026', 'pesi: il profilo si chiama EVIDENCE-2026: ' + PROFILE);
  ok(WEIGHTS.answerability === 0.25, 'pesi: answerability 0.25 (la categoria più pesante)');
  ok(WEIGHTS.agentFiles === 0.05, 'pesi: agentFiles declassata a 0.05');
  ok(WEIGHTS.answerability > WEIGHTS.structured, 'pesi: answerability pesa più di structured (evidenza Ahrefs sullo schema)');
  ok(Object.keys(WEIGHTS).length === 6, 'pesi: sei categorie pesate');
}
```

Aggiungere l'import in testa a `test.js`, dopo la riga `import { auditHtmlSnapshot } from './audit.js';`:

```js
import WEIGHTS, { PROFILE } from './weights.mjs';
```

- [ ] **Step 2: Eseguire i test e verificarne il fallimento**

Run: `npm test`
Expected: FAIL — `pesi: la somma fa esattamente 1.00 (avuta 1)` passa per caso, ma `PROFILE === 'EVIDENCE-2026'` fallisce con `PROFILE` undefined (`SyntaxError: The requested module './weights.mjs' does not provide an export named 'PROFILE'` se Node valuta l'import prima).

- [ ] **Step 3: Riscrivere `weights.mjs`**

Sostituire l'intero contenuto di `weights.mjs`:

```js
// Pesi del punteggio Beacon come MODULO JS.
// Importabile sia dalla CLI (Node ESM) sia dal bundle webpack (Next), senza
// dipendere da una lettura runtime di weights.json: il path calcolato via
// import.meta.url/__dirname NON sopravvive al bundling (viene congelato al
// percorso della build machine), causando ENOENT in produzione.
//
// Profilo EVIDENCE-2026: ogni peso ha accanto la misura che lo giustifica.
// I profili storici (BEACON, PHAROS) restano documentati in weights.json.
export const PROFILE = 'EVIDENCE-2026';

export default {
  // Tabelle e liste citate 2,5x; sezioni autonome +65%; heading-query 41% vs 29%;
  // GEO paper (ACM SIGKDD 2024): citazioni +40%, fluency +15-30%.
  answerability: 0.25,
  // Vercel + MERJ su oltre 500M fetch GPTBot: zero JavaScript eseguito.
  readability: 0.22,
  // BuzzStream, 4M citazioni: il 95% delle pagine citate bloccava GPTBot →
  // il fetch live conta più della riga nel robots.txt.
  access: 0.18,
  // Ahrefs, 1.885 pagine vs 4.000 di controllo: JSON-LD −4,6% su AI Overviews,
  // nessun effetto su ChatGPT e AI Mode.
  structured: 0.15,
  // Ahrefs, 75.000 brand: mentions r=0.664 vs backlink 0.218. Resta 0.15 e non
  // sale: quello che Beacon misura (CCBot + Common Crawl) è un proxy debole
  // delle menzioni di brand. Il peso segue la misura, non l'auspicio.
  offsite: 0.15,
  // Ahrefs, 137.210 domini: il 97% dei llms.txt non viene mai letto.
  // SE Ranking, ~300.000 domini: zero correlazione con le citazioni.
  agentFiles: 0.05,
};
```

- [ ] **Step 4: Riscrivere `weights.json`**

```json
{
  "_profile": "EVIDENCE-2026",
  "_comment": "Pesi fondati sull'evidenza empirica 2025-2026, non sulla replica di un altro strumento. answerability 0.25 (tabelle/liste citate 2,5x; GEO paper KDD 2024 +40%), readability 0.22 (Vercel/MERJ: 500M fetch GPTBot, zero JS eseguito), access 0.18 (BuzzStream: il 95% delle pagine citate bloccava GPTBot, quindi il fetch live conta più del robots.txt), structured 0.15 (Ahrefs: JSON-LD -4,6% su AI Overviews), offsite 0.15 (Ahrefs 75k brand: mentions r=0.664; tenuto basso perche CCBot+Common Crawl e un proxy debole delle menzioni), agentFiles 0.05 (Ahrefs 137k domini: il 97% dei llms.txt mai letto).",
  "_profili_storici": "BEACON (fino al 2026-08-03): access 0.23, agentFiles 0.20, structured 0.24, readability 0.23, offsite 0.10. PHAROS (replica, RMSE 0.24): access 0.26, agentFiles 0.14, structured 0.24, readability 0.26, offsite 0.10. Un profilo diverso rende i punteggi non confrontabili: vedi il campo profile nello snapshot di src/history.js.",
  "answerability": 0.25,
  "readability": 0.22,
  "access": 0.18,
  "structured": 0.15,
  "offsite": 0.15,
  "agentFiles": 0.05
}
```

- [ ] **Step 5: Far viaggiare `profile` nei due return di `audit.js`**

In `audit.js:15`, cambiare l'import:

```js
import WEIGHTS, { PROFILE } from './weights.mjs';
```

In `audit.js:108`, aggiungere `profile: PROFILE` al return di `audit()`:

```js
  return { url, host, lang: L, profile: PROFILE, fetchedOk: page.ok, overall, categories: results, rights, tech, files, html, notice, render: { active: renderJs, ok: render.ok, reason: render.reason } };
```

In `audit.js:172-186`, aggiungere la stessa riga al return di `auditHtmlSnapshot()`, dopo `lang: L,`:

```js
    lang: L,
    profile: PROFILE,
```

- [ ] **Step 6: Mostrare il profilo nel report e nella CLI**

In `src/report.js:22`, aggiungere `profile` alla forma normalizzata:

```js
  return { host: r.host, url: r.url, kind: 'pagina', pages: 1, overall: r.overall, scores, profile: r.profile || null, fixes: collectFixes(r, lang) };
```

In `src/report.js:19` (ramo `r.aggregate`), aggiungere lo stesso campo. **Il fallback non è difensivismo:** `crawl.js:99` con `--json` fa `const { home, ...rest }` e quindi elimina `home` dall'output — nel percorso CLI→JSON→report il campo non c'è. Aggiungere allora anche `profile` al return di `crawlSite` (`crawl.js:84`) e leggerlo da entrambi:

```js
    return { host: r.host, url: r.url, kind: 'sito', pages: r.pagesAnalyzed, overall: r.aggregate.overall, scores: r.aggregate.categories, profile: r.profile || r.home?.profile || null, fixes };
```

In `crawl.js:84`, aggiungere `profile: home.profile` al return, prima di `home`:

```js
  return { url: home.url, host: home.host, pagesAnalyzed: 1 + pageResults.length, profile: home.profile, home, pageResults, aggregate: aggregate(home, pageResults, weights) };
```

In `src/report.js:48`, prima della chiusura del Markdown:

```js
  if (d.profile) md += `\n*${t('report.profile', { profile: d.profile })}*\n`;
  md += `\n---\n*${t('report.md.footer')}*\n`;
```

In `src/report.js:90`, nel footer HTML:

```js
  <footer>${d.profile ? t('report.profile', { profile: d.profile }) + ' · ' : ''}${t('report.html.footer')}</footer>
```

In `audit.js:240`, aggiungere il profilo alla riga di intestazione della CLI:

```js
  console.log(`${C.dim}profilo pesi: ${r.profile} · rendering JS: ${r.render.ok ? 'attivo (post-render)' : 'no-JS — ' + r.render.reason}${C.reset}\n`);
```

- [ ] **Step 7: Aggiungere la chiave i18n in tutte e sei le lingue**

In ciascun file `src/messages/<lang>.js`, accanto alle altre chiavi `report.*`:

```js
// it.js
  'report.profile': 'Profilo pesi: {profile} — i pesi delle categorie sono pubblici e documentati in weights.json',
// en.js
  'report.profile': 'Weight profile: {profile} — category weights are public and documented in weights.json',
// de.js
  'report.profile': 'Gewichtungsprofil: {profile} — die Kategoriegewichte sind öffentlich und in weights.json dokumentiert',
// fr.js
  'report.profile': 'Profil de pondération : {profile} — les poids des catégories sont publics et documentés dans weights.json',
// es.js
  'report.profile': 'Perfil de pesos: {profile} — los pesos de las categorías son públicos y están documentados en weights.json',
// pt.js
  'report.profile': 'Perfil de pesos: {profile} — os pesos das categorias são públicos e documentados em weights.json',
```

- [ ] **Step 8: Eseguire i test**

Run: `npm test`
Expected: PASS — tutti gli assert, compresi i sei nuovi. Se un assert preesistente su un `overall` numerico fallisce, è la conseguenza attesa del cambio pesi: aggiornare il valore atteso nel test **solo** dopo aver verificato a mano il calcolo, e annotare nel messaggio dell'assert che il valore dipende dal profilo.

- [ ] **Step 9: Verifica manuale su un sito reale**

Run: `node audit.js lucarimediotti.com`
Expected: la riga sotto il punteggio mostra `profilo pesi: EVIDENCE-2026`; il punteggio complessivo è calcolato su cinque categorie (answerability non esiste ancora) e resta nel range 0-100.

- [ ] **Step 10: Commit**

```bash
git add weights.mjs weights.json audit.js src/report.js src/messages test.js
git commit -m "feat(weights): profilo EVIDENCE-2026 e campo profile nel report

Pesi rifondati sull'evidenza empirica 2025-2026 invece che sulla replica di
Pharos. Ogni peso porta accanto la misura che lo giustifica; il nome del
profilo viaggia fino al report perche un cambio di taratura non deve
travestirsi da cambio del sito.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 2: Helper di parsing per l'answer-readiness

Cinque funzioni pure in `src/lib.js`. Vanno qui e non in `analyzers.js` perché sono parsing HTML, come `semanticRatio`, `headings` e `imgAlt` che già stanno lì; gli analizzatori le compongono.

**Files:**
- Modify: `src/lib.js` (aggiunte dopo `links()`, riga 199)
- Test: `test.js`

**Interfaces:**
- Consumes: `bodyHtml(html)`, `contentHtml(html)`, `count(html, re)`, `links(html, host)` — già in `src/lib.js`
- Produces:
  - `stripTags(html) → string` — testo nudo, entità collassate
  - `htmlLang(html) → string|null` — codice a due lettere da `<html lang>`
  - `sections(html) → Array<{ heading: string, firstSentenceWords: number }>` — una voce per H2/H3
  - `extractableBlocks(html) → { lists: number, tables: number, total: number }`
  - `paragraphWords(html) → { total: number, long: number, words: number[] }`
  - `citableEvidence(html, host) → { numbers: number, quotes: number, extLinks: number, total: number }`

- [ ] **Step 1: Scrivere gli assert che falliscono — i falsi positivi per primi**

In `test.js`, dopo il blocco `// HTML helpers` esistente, inserire:

```js
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
}
{
  ok(htmlLang('<html lang="de-CH"><body></body></html>') === 'de', 'lingua: <html lang="de-CH"> → de');
  ok(htmlLang('<html><body></body></html>') === null, 'lingua: senza attributo → null');
  ok(stripTags('<p>uno <b>due</b>&nbsp;tre</p>').trim() === 'uno due tre', 'stripTags: tag via, entità collassata');
}
```

Aggiungere gli import: in `test.js:4` la riga degli import da `./src/lib.js` diventa (mantenendo i nomi già presenti e aggiungendo i nuovi):

```js
import { parseRobots, getTitle, getMeta, jsonLdTypes, semanticRatio, wordCount, imgAlt, headings, links, normUrl, stripTags, htmlLang, sections, extractableBlocks, paragraphWords, citableEvidence } from './src/lib.js';
```

*(Leggere la riga 4 esistente con `node -e` e ricopiarla per intero prima di aggiungere: contiene altri nomi che il presente estratto potrebbe non citare.)*

- [ ] **Step 2: Eseguire i test e verificarne il fallimento**

Run: `npm test`
Expected: FAIL — `SyntaxError: The requested module './src/lib.js' does not provide an export named 'stripTags'`.

- [ ] **Step 3: Implementare gli helper in `src/lib.js`**

Aggiungere dopo `links()` (riga 199), prima della sezione `// ---------- robots.txt ----------`:

```js
// ---------- answer-readiness (funzioni pure) ----------
// ponytail: regex, non un parser DOM — stessa scelta di semanticRatio/headings/imgAlt
// ponytail: e vincolo di progetto (zero dipendenze). HTML gravemente malformato (<p> mai
// ponytail: chiusi) degrada paragraphWords: la via d'uscita è un tokenizer minimale, non cheerio.

// Testo nudo: via i tag, le entità diventano spazio, gli spazi si collassano.
export function stripTags(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Lingua dichiarata dalla pagina. Serve al check dei titoli-domanda: le parole
// interrogative vanno cercate nella lingua del SITO, non in quella del report.
export function htmlLang(html) {
  const m = String(html || '').match(/<html[^>]*\slang=["']?([a-z]{2})/i);
  return m ? m[1].toLowerCase() : null;
}

// Conta le parole di un testo già nudo (stessa regola di wordCount, senza stripping).
const textWords = (s) => (String(s || '').match(/[\p{L}\p{N}]{2,}/gu) || []).length;

// Prima frase: fino al primo punto/!/? seguito da spazio o fine. Senza punteggiatura
// entro 600 caratteri si taglia lì: un muro di testo senza punti è già la risposta
// che il check vuole segnalare.
function firstSentence(text) {
  const s = String(text || '').trim();
  const m = s.match(/^[\s\S]{1,600}?[.!?](?:\s|$)/);
  return m ? m[0] : s.slice(0, 600);
}

// Una voce per ogni H2/H3, con la lunghezza in parole della prima frase del blocco
// di testo che lo segue. Il blocco è il primo <p> dopo l'heading; se non c'è <p>,
// è il testo nudo fino all'heading successivo.
export function sections(html) {
  const body = bodyHtml(html);
  const re = /<h([23])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  const found = [];
  let m;
  while ((m = re.exec(body))) found.push({ heading: stripTags(m[2]), from: re.lastIndex, level: m[1] });
  return found.map((s, i) => {
    const chunk = body.slice(s.from, i + 1 < found.length ? found[i + 1].from : body.length);
    const p = chunk.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
    const text = stripTags(p ? p[1] : chunk);
    return { heading: s.heading, level: s.level, firstSentenceWords: textWords(firstSentence(text)) };
  });
}

// Blocchi che una AI può estrarre e citare: liste con almeno 3 voci e tabelle con
// intestazioni. Navigazione, header e footer sono esclusi: senza questo filtro ogni
// sito WordPress guadagnerebbe punti per il proprio menu. Esclusa anche la lista in
// cui oltre il 70% delle voci è praticamente solo un link (widget "articoli recenti").
export function extractableBlocks(html) {
  const body = bodyHtml(html)
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header\b[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, ' ');
  let lists = 0;
  for (const m of body.matchAll(/<(ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const items = m[2].match(/<li\b[\s\S]*?<\/li>/gi) || [];
    if (items.length < 3) continue;
    const linkOnly = items.filter((li) => {
      const txt = stripTags(li);
      if (!txt) return true;
      const anchor = stripTags((li.match(/<a\b[\s\S]*?<\/a>/i) || [''])[0]);
      return anchor.length >= txt.length * 0.8;
    }).length;
    if (linkOnly / items.length > 0.7) continue;
    lists++;
  }
  const tables = [...body.matchAll(/<table\b[\s\S]*?<\/table>/gi)].filter((m) => /<th\b/i.test(m[0])).length;
  return { lists, tables, total: lists + tables };
}

// Distribuzione delle parole per paragrafo. I paragrafi sotto le 10 parole
// (didascalie, note, "Leggi anche") non sono prosa: fuori dal denominatore.
export function paragraphWords(html) {
  const words = (bodyHtml(html).match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || [])
    .map((p) => textWords(stripTags(p)))
    .filter((n) => n >= 10);
  return { total: words.length, long: words.filter((n) => n > 120).length, words };
}

// Elementi che rendono un passaggio citabile: dati con unità di misura, anni,
// citazioni esplicite, link a fonti esterne dentro il testo (non nel menu).
export function citableEvidence(html, host) {
  const body = bodyHtml(html)
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, ' ');
  const text = stripTags(body);
  const withUnit = text.match(/\d[\d.,]*\s?(?:%|€|\$|CHF|USD|EUR|km|kg|mq|m²|GB|MB|ms|s\b|min\b|ore|anni|giorni|volte|x\b)/gi) || [];
  const years = text.match(/\b(?:19|20)\d{2}\b/g) || [];
  const big = text.match(/\b\d{1,3}(?:[.\s]\d{3})+\b/g) || [];
  const quotes = count(body, /<blockquote\b/gi) + count(body, /<cite\b/gi);
  let extLinks = 0;
  for (const p of body.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || []) extLinks += links(p, host).external;
  const numbers = withUnit.length + years.length + big.length;
  return { numbers, quotes, extLinks, total: numbers + quotes + extLinks };
}
```

- [ ] **Step 4: Eseguire i test**

Run: `npm test`
Expected: PASS — tutti i nuovi assert. Se `evidenza: percentuale, anno e numero grande contati` fallisce con un valore superiore all'atteso, verificare che `137.210` non sia contato due volte (una da `big`, una da `withUnit`): il test chiede `>= 3`, quindi il doppio conteggio non lo rompe, ma va annotato nel commento se emerge.

- [ ] **Step 5: Commit**

```bash
git add src/lib.js test.js
git commit -m "feat(lib): helper di parsing per l'answer-readiness

sections, extractableBlocks, paragraphWords, citableEvidence, stripTags,
htmlLang. Le liste di navigazione e i widget di soli link sono esclusi dai
blocchi estraibili: senza quel filtro ogni sito WordPress prenderebbe punti
per il proprio menu.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 3: `analyzeAnswerability` — i cinque check

**Files:**
- Modify: `src/analyzers.js` (nuovo analizzatore dopo `analyzeReadability`, riga 152)
- Modify: `src/messages/it.js` (chiavi `answerability.*` e `category.answerability`)
- Test: `test.js`

**Interfaces:**
- Consumes: gli helper del Task 2
- Produces:
  - `QUESTION_WORDS: Record<'it'|'en'|'de'|'fr'|'es'|'pt', string[]>`
  - `isQuestionHeading(text: string, lang: string) → boolean`
  - `pageLang(html: string, fallback = 'it') → string`
  - `analyzeAnswerability({ served, host }, lang = 'it') → { score, checks, unmeasured? }`

I pesi interni dei check sommano 100: risposta diretta 25, blocchi estraibili 20, paragrafi digeribili 20, titoli-domanda 15, evidenza citabile 20.

- [ ] **Step 1: Scrivere gli assert che falliscono — prima il caso `unmeasured`**

In `test.js`, dopo il blocco degli helper del Task 2:

```js
// answerability: la pagina che non è contenuto non va penalizzata, va esclusa.
{
  const breve = '<html lang="it"><body><main><h1>Contatti</h1><p>Scrivici a info@esempio.it oppure chiamaci in orario di ufficio.</p></main></body></html>';
  const a = analyzeAnswerability({ served: breve, host: 'esempio.it' });
  ok(a.unmeasured === true, 'answerability: sotto le 300 parole la categoria esce dal punteggio');
  ok(a.checks.length === 1 && a.checks[0].status === 'info', 'answerability: unmeasured spiega perché, senza fix inventati');
}
{
  // Pagina ben strutturata: risposta breve dopo ogni heading, liste, paragrafi corti, dati.
  const buona = '<html lang="it"><body><main><h1>Guida</h1>'
    + '<h2>Che cos\'è il GEO?</h2><p>È la disciplina che rende un sito citabile dai motori generativi.</p>'
    + '<p>' + 'parola '.repeat(60) + '</p>'
    + '<h2>Quanto conta il robots.txt?</h2><p>Conta meno di quanto si creda, secondo i dati.</p>'
    + '<p>Nel 2026 il 95% delle pagine citate bloccava GPTBot, su 4.000.000 di citazioni analizzate.</p>'
    + '<ul><li>Verifica il testo servito senza JavaScript</li><li>Controlla la sitemap dichiarata</li><li>Misura le liste e le tabelle della pagina</li></ul>'
    + '<blockquote>Correlazione non è causalità.</blockquote>'
    + '<p>Fonte: <a href="https://ahrefs.com/blog/">Ahrefs</a>. ' + 'parola '.repeat(200) + '</p>'
    + '</main></body></html>';
  const a = analyzeAnswerability({ served: buona, host: 'esempio.it' });
  ok(!a.unmeasured, 'answerability: pagina oltre le 300 parole viene misurata');
  ok(a.score >= 70, 'answerability: pagina ben strutturata prende un voto alto: ' + a.score);
  ok(a.checks.length === 5, 'answerability: cinque check (avuti ' + a.checks.length + ')');
  ok(a.checks.filter((c) => c.status === 'good').length >= 4, 'answerability: almeno quattro check verdi');
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

  const de = '<html lang="de"><body><main><h2>Wie funktioniert Beacon?</h2><p>Kurz gesagt: es misst.</p><p>' + 'wort '.repeat(400) + '</p></main></body></html>';
  const a = analyzeAnswerability({ served: de, host: 'esempio.de' }, 'it');
  const q = a.checks.find((c) => c.name.toLowerCase().includes('domanda'));
  ok(q && q.status === 'good', 'answerability: heading tedesco valutato in tedesco anche con report in italiano');
}
{
  ok(pageLang('<html lang="fr"><body></body></html>') === 'fr', 'pageLang: attributo lang rispettato');
  ok(pageLang('<html><body><p>Il sito è una vetrina che non ha dichiarato la lingua nel markup</p></body></html>') === 'it', 'pageLang: fallback euristico sulle stopword italiane');
  ok(pageLang('<html><body><p>The site does not declare its language in the markup and that is the case here</p></body></html>') === 'en', 'pageLang: fallback euristico sulle stopword inglesi');
}
```

Aggiungere ai nomi importati da `./src/analyzers.js` in `test.js:5`: `analyzeAnswerability, isQuestionHeading, pageLang`.

- [ ] **Step 2: Eseguire i test e verificarne il fallimento**

Run: `npm test`
Expected: FAIL — `does not provide an export named 'analyzeAnswerability'`.

- [ ] **Step 3: Implementare in `src/analyzers.js`**

Estendere l'import da `./lib.js` (riga 7) con i nuovi helper:

```js
import { getTitle, getMeta, jsonLdTypes, jsonLdCount, semanticRatio, headings, imgAlt, wordCount, links, sections, extractableBlocks, paragraphWords, citableEvidence, htmlLang, stripTags } from './lib.js';
```

Aggiungere dopo `readabilityMetrics()` (riga 152):

```js
// ⑥ RISPOSTA PRONTA PER LE AI (answer-readiness) — il pilastro editoriale del GEO:
// non «una macchina vede il testo» (readability) ma «il testo risponde a una domanda
// in una forma estraibile e citabile». Base empirica dei pesi in weights.json.

// Parole interrogative per lingua. Sono DATI, non stringhe di interfaccia: stanno qui
// e non in src/messages/, che è il catalogo dei testi mostrati all'utente.
// Solo forme non ambigue a inizio titolo: 'o'/'que'/'is' da soli darebbero falsi
// positivi su qualsiasi titolo che inizia con un articolo, quindi si usano i bigrammi.
export const QUESTION_WORDS = {
  it: ['come', 'cosa', 'cos\'è', 'perché', 'perche', 'quando', 'quanto', 'quanta', 'quanti', 'quante', 'quale', 'quali', 'chi', 'dove', 'che cos'],
  en: ['how', 'what', 'why', 'when', 'where', 'who', 'which', 'can i', 'can you', 'do i', 'does it', 'is it', 'should i'],
  de: ['wie', 'was', 'warum', 'wann', 'wo', 'wer', 'welche', 'welcher', 'welches', 'wieso', 'weshalb'],
  fr: ['comment', 'pourquoi', 'quand', 'où', 'qui', 'quel', 'quelle', 'quels', 'quelles', 'combien', 'qu\'est-ce'],
  es: ['cómo', 'como', 'por qué', 'por que', 'cuándo', 'cuando', 'dónde', 'donde', 'quién', 'quien', 'cuál', 'cual', 'cuánto', 'cuanto', 'qué es'],
  pt: ['como', 'por que', 'porquê', 'quando', 'onde', 'quem', 'qual', 'quais', 'quanto', 'quantos', 'o que'],
};

// Stopword ad alta frequenza per il fallback di lingua. ponytail: euristica a
// conteggio, non un identificatore statistico — basta a distinguere sei lingue
// europee su una pagina intera; un langid vero è la via d'uscita se serve di più.
const LANG_HINTS = {
  it: [' il ', ' la ', ' che ', ' di ', ' non ', ' per ', ' una '],
  en: [' the ', ' and ', ' of ', ' to ', ' is ', ' that ', ' with '],
  de: [' der ', ' die ', ' das ', ' und ', ' ist ', ' nicht ', ' für '],
  fr: [' le ', ' la ', ' les ', ' des ', ' est ', ' pour ', ' que '],
  es: [' el ', ' la ', ' los ', ' que ', ' de ', ' para ', ' con '],
  pt: [' o ', ' os ', ' que ', ' de ', ' para ', ' com ', ' não '],
};

// Lingua della PAGINA: <html lang> se c'è, altrimenti la lingua le cui stopword
// compaiono più spesso nel testo. Il `lang` del report non decide: un sito italiano
// analizzato con report in inglese va valutato con le parole interrogative italiane.
export function pageLang(html, fallback = 'it') {
  const declared = htmlLang(html);
  if (declared && QUESTION_WORDS[declared]) return declared;
  const text = (' ' + stripTags(html).toLowerCase() + ' ');
  let best = null, bestScore = 0;
  for (const [lang, hints] of Object.entries(LANG_HINTS)) {
    const n = hints.reduce((a, h) => a + (text.split(h).length - 1), 0);
    if (n > bestScore) { bestScore = n; best = lang; }
  }
  return bestScore >= 3 && best ? best : fallback;
}

// Un titolo è in forma di domanda se finisce con "?" o se inizia con una parola
// interrogativa della lingua della pagina, confrontata su parola intera.
export function isQuestionHeading(text, lang = 'it') {
  const s = String(text || '').trim().toLowerCase();
  if (!s) return false;
  if (s.endsWith('?')) return true;
  const words = QUESTION_WORDS[lang] || QUESTION_WORDS.it;
  return words.some((w) => s === w || s.startsWith(w + ' ') || s.startsWith(w + '\''));
}

const MIN_WORDS_ANSWERABILITY = 300;

export function analyzeAnswerability({ served, host }, lang = 'it') {
  const t = makeT(lang);
  const words = wordCount(served || '');

  // Sotto le 300 parole non c'è contenuto da giudicare: home vetrina, listing,
  // pagina contatti. `unmeasured` esce dalla media pesata (vedi audit.js) — stesso
  // meccanismo già usato da analyzeOffsite quando Common Crawl non risponde:
  // «non ho i presupposti per giudicare» ≠ «il sito è fatto male».
  if (words < MIN_WORDS_ANSWERABILITY) {
    return {
      unmeasured: true,
      score: 0,
      checks: [{ name: t('answerability.unmeasured.name'), status: 'info', detail: t('answerability.unmeasured.detail', { words }) }],
    };
  }

  const pLang = pageLang(served, lang);
  const secs = sections(served);
  const blocks = extractableBlocks(served);
  const paras = paragraphWords(served);
  const ev = citableEvidence(served, host);

  // ① risposta diretta dopo l'heading (25). Mediana e non media: una sola sezione
  // con un cappello lungo non deve affossare una pagina per il resto pulita.
  const lens = secs.map((s) => s.firstSentenceWords).filter((n) => n > 0).sort((a, b) => a - b);
  const median = lens.length ? lens[Math.floor(lens.length / 2)] : null;
  const directPts = median === null ? 12 : median <= 30 ? 25 : median <= 50 ? 14 : 4;
  const directStatus = median === null ? 'info' : median <= 30 ? 'good' : median <= 50 ? 'warn' : 'crit';

  // ② blocchi estraibili (20): almeno uno ogni 500 parole.
  const per500 = blocks.total / Math.max(1, words / 500);
  const blocksPts = per500 >= 1 ? 20 : per500 >= 0.5 ? 11 : blocks.total ? 5 : 0;
  const blocksStatus = per500 >= 1 ? 'good' : per500 >= 0.5 ? 'warn' : 'crit';

  // ③ paragrafi digeribili (20): meno del 10% oltre le 120 parole.
  const longRatio = paras.total ? paras.long / paras.total : 0;
  const parasPts = !paras.total ? 8 : longRatio < 0.1 ? 20 : longRatio < 0.25 ? 11 : 3;
  const parasStatus = !paras.total ? 'warn' : longRatio < 0.1 ? 'good' : longRatio < 0.25 ? 'warn' : 'crit';

  // ④ titoli in forma di domanda (15): almeno un quarto degli H2/H3.
  const qHave = secs.filter((s) => isQuestionHeading(s.heading, pLang)).length;
  const qRatio = secs.length ? qHave / secs.length : 0;
  const qPts = qRatio >= 0.25 ? 15 : qRatio >= 0.1 ? 8 : 0;
  const qStatus = qRatio >= 0.25 ? 'good' : qRatio >= 0.1 ? 'warn' : secs.length ? 'crit' : 'info';

  // ⑤ evidenza citabile (20): almeno tre elementi fra dati, citazioni e fonti.
  const evPts = ev.total >= 3 ? 20 : ev.total >= 1 ? 10 : 0;
  const evStatus = ev.total >= 3 ? 'good' : ev.total >= 1 ? 'warn' : 'crit';

  const score = clamp(directPts + blocksPts + parasPts + qPts + evPts);

  return {
    score,
    checks: [
      { name: t('answerability.direct.name'), status: directStatus,
        detail: t('answerability.direct.detail', { median: median === null ? '—' : median, sections: secs.length }),
        fix: directStatus === 'good' || directStatus === 'info' ? null : t('answerability.direct.fix') },
      { name: t('answerability.blocks.name'), status: blocksStatus,
        detail: t('answerability.blocks.detail', { blocks: blocks.total, words, lists: blocks.lists, tables: blocks.tables }),
        fix: blocksStatus === 'good' ? null : t('answerability.blocks.fix') },
      { name: t('answerability.paras.name'), status: parasStatus,
        detail: t('answerability.paras.detail', { long: paras.long, total: paras.total }),
        fix: parasStatus === 'good' ? null : t('answerability.paras.fix') },
      { name: t('answerability.questions.name'), status: qStatus,
        detail: t('answerability.questions.detail', { have: qHave, total: secs.length, lang: pLang }),
        fix: qStatus === 'good' || qStatus === 'info' ? null : t('answerability.questions.fix') },
      { name: t('answerability.evidence.name'), status: evStatus,
        detail: t('answerability.evidence.detail', { count: ev.total, numbers: ev.numbers, quotes: ev.quotes, links: ev.extLinks }),
        fix: evStatus === 'good' ? null : t('answerability.evidence.fix') },
    ],
  };
}
```

- [ ] **Step 4: Aggiungere le chiavi italiane in `src/messages/it.js`**

Dopo il gruppo `readability.*`:

```js
  // answerability — risposta pronta per le AI
  'answerability.direct.name': 'Risposta diretta dopo il titolo',
  'answerability.direct.detail': 'prima frase dopo H2/H3: {median} parole (mediana su {sections} sezioni)',
  'answerability.direct.fix': 'Apri ogni sezione con una frase di risposta sotto le 30 parole, poi sviluppa',
  'answerability.blocks.name': 'Blocchi estraibili (liste, tabelle)',
  'answerability.blocks.detail': '{blocks} blocchi su {words} parole ({lists} liste, {tables} tabelle)',
  'answerability.blocks.fix': 'Trasforma le enumerazioni in liste e i confronti in tabelle con intestazioni',
  'answerability.paras.name': 'Paragrafi digeribili',
  'answerability.paras.detail': '{long}/{total} paragrafi oltre le 120 parole',
  'answerability.paras.fix': 'Spezza i paragrafi lunghi: un concetto per paragrafo, sotto le 120 parole',
  'answerability.questions.name': 'Titoli in forma di domanda',
  'answerability.questions.detail': '{have}/{total} titoli H2-H3 in forma di domanda (lingua della pagina: {lang})',
  'answerability.questions.fix': 'Riformula i titoli come le domande che le persone digitano davvero',
  'answerability.evidence.name': 'Evidenza citabile',
  'answerability.evidence.detail': '{count} elementi: {numbers} dati, {quotes} citazioni, {links} link a fonti',
  'answerability.evidence.fix': 'Aggiungi dati con unità di misura, citazioni e link alle fonti',
  'answerability.unmeasured.name': 'Contenuto insufficiente per la misura',
  'answerability.unmeasured.detail': '{words} parole: sotto le 300 questa categoria esce dal punteggio invece di penalizzare la pagina',
```

E la categoria, accanto alle altre `category.*`:

```js
  'category.answerability': 'Risposta pronta per le AI',
```

- [ ] **Step 5: Eseguire i test**

Run: `npm test`
Expected: PASS. Il test di parità dei dizionari (`test.js:900-903`) **non** fallisce ancora: controlla solo che le altre lingue non abbiano buchi rispetto all'italiano, e l'italiano ora ha 18 chiavi in più → **fallisce**. Questo è atteso: le traduzioni arrivano nel Task 9. Per tenere il repo verde nel frattempo, eseguire `npm test` e verificare che l'unico assert rosso sia `catalogo <lang>: nessuna chiave mancante`. Se si preferisce non avere test rossi fra i task, anticipare qui il solo Task 9 limitato alle chiavi `answerability.*`.

- [ ] **Step 6: Commit**

```bash
git add src/analyzers.js src/messages/it.js test.js
git commit -m "feat(answerability): cinque check di answer-readiness

Risposta diretta dopo l'heading (mediana, non media), blocchi estraibili,
paragrafi digeribili, titoli-domanda nella lingua della PAGINA, evidenza
citabile. Sotto le 300 parole la categoria si dichiara unmeasured invece di
penalizzare una pagina contatti.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 4: Innestare `answerability` negli orchestratori

**Files:**
- Modify: `src/analyzers.js:184-191` (`categoryLabels`)
- Modify: `audit.js:10` (import), `audit.js:72-78` (`results` in `audit()`), `audit.js:144-150` (`results` in `auditHtmlSnapshot()`)
- Modify: `crawl.js:8` (import), `crawl.js:42-56` (`aggregate`), `crawl.js:74-81` (page-level)
- Test: `test.js`

**Interfaces:**
- Consumes: `analyzeAnswerability({ served, host }, lang)` dal Task 3
- Produces: `results.answerability` nel report; `aggregate()` accetta `answerability` fra le categorie e la media solo sulle pagine misurate

- [ ] **Step 1: Scrivere gli assert che falliscono**

```js
// crawl.js — answerability è page-level e può essere unmeasured su singole pagine
{
  const home = { url: 'https://x.com/', categories: { access: { score: 100 }, agentFiles: { score: 60 }, structured: { score: 80 }, readability: { score: 40 }, offsite: { score: 100 }, answerability: { score: 50 } } };
  const pages = [{ structured: 60, readability: 80, answerability: 70 }, { structured: 40, readability: 60, answerability: null }];
  const w = { access: 0.18, agentFiles: 0.05, structured: 0.15, readability: 0.22, offsite: 0.15, answerability: 0.25 };
  const a = aggregate(home, pages, w);
  ok(a.categories.answerability === 60, 'crawl: answerability = media(50,70) ignorando la pagina non misurata: ' + a.categories.answerability);
  ok(a.overall > 0 && a.overall <= 100, 'crawl: overall nel range con sei categorie: ' + a.overall);

  // Tutte le pagine non misurate: la categoria esce dal denominatore, non vale 0.
  const soloBrevi = aggregate({ url: 'https://x.com/', categories: { access: { score: 100 }, agentFiles: { score: 100 }, structured: { score: 100 }, readability: { score: 100 }, offsite: { score: 100 }, answerability: { score: 0, unmeasured: true } } }, [], w);
  ok(soloBrevi.overall === 100, 'crawl: answerability tutta non misurata esce dalla media (atteso 100, avuto ' + soloBrevi.overall + ')');
}
// audit: la categoria compare fra quelle pesate e il profilo viaggia nel risultato
{
  const html = '<html lang="it"><head><title>Pagina di prova per Beacon</title></head><body><main><h2>Come funziona?</h2><p>Funziona misurando l\'HTML servito.</p><p>' + 'parola '.repeat(400) + '</p></main></body></html>';
  ok(Object.keys(CATEGORY_LABELS).includes('answerability'), 'audit: answerability è fra le categorie pesate');
  ok(Object.keys(CATEGORY_LABELS).length === 6, 'audit: sei categorie pesate (avute ' + Object.keys(CATEGORY_LABELS).length + ')');
}
```

Aggiungere `CATEGORY_LABELS` ai nomi importati da `./src/analyzers.js` in `test.js:5`.

- [ ] **Step 2: Eseguire i test e verificarne il fallimento**

Run: `npm test`
Expected: FAIL — `audit: answerability è fra le categorie pesate` e `crawl: answerability = media(50,70)…` (la chiave non esiste ancora in `aggregate`).

- [ ] **Step 3: Aggiungere l'etichetta in `categoryLabels`**

`src/analyzers.js:184-190` diventa:

```js
export function categoryLabels(lang = 'it') {
  const t = makeT(lang);
  return {
    access: t('category.access'), agentFiles: t('category.agentFiles'), structured: t('category.structured'),
    readability: t('category.readability'), answerability: t('category.answerability'), offsite: t('category.offsite'),
  };
}
```

L'ordine conta: è quello in cui CLI, report e web elencano le categorie. `answerability` sta accanto a `readability` perché sono le due facce dello stesso contenuto — una guarda se la macchina *vede*, l'altra se *può rispondere*.

- [ ] **Step 4: Innestare nei due orchestratori di `audit.js`**

Estendere l'import (riga 10) con `analyzeAnswerability`.

In `audit.js:72-78`:

```js
  const results = {
    access: analyzeAccess({ robotsAllowed, liveFetch }, L),
    agentFiles: analyzeAgentFiles(files, L),
    structured: analyzeStructured(html, L),
    readability: analyzeReadability({ served: html, rendered: renderedHtml }, L),
    // Sul post-render se disponibile: una SPA senza JS non ha contenuto da giudicare
    // e la categoria si dichiarerebbe unmeasured per un motivo sbagliato.
    answerability: analyzeAnswerability({ served: renderedHtml || html, host }, L),
    offsite: analyzeOffsite({ ccbotAllowed: robotsAllowed['CCBot'], inCommonCrawl }, L),
  };
```

In `audit.js:144-150` (`auditHtmlSnapshot`, senza render):

```js
  const results = {
    access: analyzeAccess({ robotsAllowed, liveFetch }, L),
    agentFiles: analyzeAgentFiles(files, L),
    structured: analyzeStructured(html, L),
    readability: analyzeReadability({ served: html, rendered: null }, L),
    answerability: analyzeAnswerability({ served: html, host }, L),
    offsite: analyzeOffsite({ ccbotAllowed: robotsAllowed['CCBot'], inCommonCrawl }, L),
  };
```

- [ ] **Step 5: Aggiornare `crawl.js`**

Import (riga 8): aggiungere `analyzeAnswerability`.

`crawl.js:42-56` diventa:

```js
export function aggregate(homeAudit, pageResults, weights) {
  const avg = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);
  const structured = avg([homeAudit.categories.structured.score, ...pageResults.map((p) => p.structured)]);
  const readability = avg([homeAudit.categories.readability.score, ...pageResults.map((p) => p.readability)]);
  // answerability: media SOLO sulle pagine misurate. Una pagina contatti che si
  // dichiara unmeasured non deve abbassare il voto del sito, e se nessuna pagina
  // è misurabile la categoria esce dal denominatore (come in audit.js).
  const ansScores = [
    ...(homeAudit.categories.answerability?.unmeasured ? [] : [homeAudit.categories.answerability?.score]),
    ...pageResults.map((p) => p.answerability),
  ].filter((n) => typeof n === 'number');
  const cats = {
    access: homeAudit.categories.access.score,       // site-level
    agentFiles: homeAudit.categories.agentFiles.score, // site-level
    structured,                                        // page-level (media)
    readability,                                       // page-level (media)
    answerability: ansScores.length ? avg(ansScores) : null, // page-level, null = non misurata
    offsite: homeAudit.categories.offsite.score,       // site-level
  };
  let total = 0, wsum = 0;
  for (const k of Object.keys(CATEGORY_LABELS)) {
    if (cats[k] === null) continue;
    total += cats[k] * weights[k];
    wsum += weights[k];
  }
  return { overall: wsum ? Math.round(total / wsum) : 0, categories: cats };
}
```

`crawl.js:80` (raccolta page-level) diventa:

```js
    const ans = analyzeAnswerability({ served: rendered || res.body, host: new URL(u).host }, lang);
    pageResults.push({
      url: u,
      structured: analyzeStructured(res.body, lang).score,
      readability: analyzeReadability({ served: res.body, rendered }, lang).score,
      answerability: ans.unmeasured ? null : ans.score,
    });
```

- [ ] **Step 6: Eseguire i test**

Run: `npm test`
Expected: PASS (a parte il previsto rosso sulla parità dei dizionari, che si chiude nel Task 9).

- [ ] **Step 7: Verifica su un sito reale con contenuto lungo**

Run: `node audit.js https://lucarimediotti.com/blog --js`
Expected: nell'elenco compare «Risposta pronta per le AI» con cinque check e un punteggio; la CLI mostra sei categorie.

- [ ] **Step 8: Commit**

```bash
git add src/analyzers.js audit.js crawl.js test.js
git commit -m "feat(audit): answerability come sesta categoria pesata

Innestata in audit(), auditHtmlSnapshot() e aggregate(). Nel crawl la media
salta le pagine che si dichiarano unmeasured: una pagina contatti non deve
abbassare il voto del sito.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 5: `analyzeAgentReady` — categoria informativa

Fuori da `CATEGORY_LABELS`: strutturalmente incapace di entrare nell'overall. Quattro check, uno dei quali dichiara il proprio limite.

**Files:**
- Modify: `src/lib.js:72` (esporre gli header in `fetchText`)
- Modify: `src/analyzers.js` (nuovo analizzatore accanto a `analyzeRights`)
- Modify: `audit.js` (probe + return, in **entrambe** le funzioni)
- Modify: `src/messages/it.js`
- Test: `test.js`

**Interfaces:**
- Consumes: `liveFetch` (già raccolto), `page.headers`, `robotsTxt`, `renderedHtml`, `files`
- Produces: `analyzeAgentReady({ contentUsage, botAuth, webmcp, conventions }, lang) → { informational: true, score, checks }` e `AGENT_READY_LABEL`. Forma degli argomenti:
  - `contentUsage: { source: 'header'|'robots'|null, raw: string|null }`
  - `botAuth: { browserOk: boolean, aiOk: number, aiTotal: number }`
  - `webmcp: { rendered: boolean, api: string|null }`
  - `conventions: { skillMd: boolean, mcpJson: boolean, agentSkills: boolean }`

- [ ] **Step 1: Scrivere gli assert che falliscono**

```js
// agentReady — informativa per scelta: nessuna evidenza che questi segnali correlino
// con le citazioni, e pesarli perché sono moderni ripeterebbe l'errore di llms.txt.
{
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
```

Import da aggiungere: `analyzeAgentReady` da `./src/analyzers.js`, `parseContentUsage, detectWebmcp` da `./src/analyzers.js`.

- [ ] **Step 2: Eseguire i test e verificarne il fallimento**

Run: `npm test`
Expected: FAIL — export inesistenti.

- [ ] **Step 3: Esporre gli header in `fetchText`**

`src/lib.js:72` diventa:

```js
      // `headers` è l'oggetto Headers nativo: serve ad AIPREF (Content-Usage) e non
      // finisce nel JSON del report (Headers non è serializzabile).
      return { ok: res.ok, status: res.status, body, finalUrl, headers: res.headers };
```

- [ ] **Step 4: Implementare l'analizzatore**

In `src/analyzers.js`, dopo `analyzeRights` (riga 213):

```js
// ⑦ STANDARD D'AVANGUARDIA PER GLI AGENTI — informativo (NON pesato).
// Informativo per scelta, non per prudenza: non esiste evidenza che questi segnali
// correlino con le citazioni. Pesarli perché sono moderni ripeterebbe esattamente
// l'errore di llms.txt (Ahrefs, 137.210 domini: il 97% dei file mai letto).

// AIPREF (IETF AI Preferences WG): la preferenza può stare nell'header HTTP
// Content-Usage o in una regola omonima del robots.txt. L'header ha precedenza.
export function parseContentUsage(headerValue, robotsTxt) {
  const h = headerValue && String(headerValue).trim();
  if (h) return { source: 'header', raw: h };
  const m = String(robotsTxt || '').match(/^\s*content-usage\s*:\s*(.+)$/im);
  if (m) return { source: 'robots', raw: m[1].trim() };
  return { source: null, raw: null };
}

// WebMCP (W3C Draft Community Group Report): si cerca la REGISTRAZIONE di un tool,
// non la parola. `document.modelContext` è l'API corrente; `navigator.modelContext`
// è deprecata da Chrome 150 e va segnalata come tale.
// ponytail: rilevazione testuale sull'HTML renderizzato — non eseguiamo l'API.
export function detectWebmcp(html) {
  const s = String(html || '');
  if (/document\s*\.\s*modelContext/.test(s)) return 'document.modelContext';
  if (/navigator\s*\.\s*modelContext/.test(s)) return 'navigator.modelContext';
  return null;
}

export function analyzeAgentReady({ contentUsage, botAuth, webmcp, conventions }, lang = 'it') {
  const t = makeT(lang);
  const usage = contentUsage || { source: null, raw: null };
  const ba = botAuth || { browserOk: false, aiOk: 0, aiTotal: 0 };
  const mcp = webmcp || { rendered: false, api: null };
  const conv = conventions || {};
  const convHave = ['skillMd', 'mcpJson', 'agentSkills'].filter((k) => conv[k]).length;

  // Il sito filtra per user-agent se il browser passa e qualche UA AI no.
  const filtered = ba.browserOk && ba.aiTotal > 0 && ba.aiOk < ba.aiTotal;

  const checks = [
    { name: t('agentReady.usage.name'), status: usage.source ? 'good' : 'info',
      detail: usage.source ? t('agentReady.usage.detail.ok', { source: usage.source, raw: usage.raw }) : t('agentReady.usage.detail.none'),
      fix: usage.source ? null : t('agentReady.usage.fix') },
    { name: t('agentReady.botauth.name'), status: filtered ? 'warn' : 'info',
      // Beacon non può verificare dall'esterno se l'edge verifica le firme: è il bot
      // che firma, non il sito, e inviare un Signature-Agent senza firma valida
      // sarebbe spoofing, non una misura. Il check è diagnostico e lo dichiara.
      detail: (filtered
        ? t('agentReady.botauth.detail.filtered', { aiOk: ba.aiOk, aiTotal: ba.aiTotal })
        : t('agentReady.botauth.detail.uniform')) + ' — ' + t('agentReady.botauth.limit'),
      limit: true,
      fix: filtered ? t('agentReady.botauth.fix') : null },
    { name: t('agentReady.webmcp.name'),
      status: mcp.api ? 'good' : 'info',
      detail: mcp.api
        ? t('agentReady.webmcp.detail.ok', { api: mcp.api }) + (mcp.api === 'navigator.modelContext' ? ' — ' + t('agentReady.webmcp.deprecated') : '')
        : (mcp.rendered ? t('agentReady.webmcp.detail.none') : t('agentReady.webmcp.detail.norender')),
      fix: mcp.api || !mcp.rendered ? null : t('agentReady.webmcp.fix') },
    { name: t('agentReady.conventions.name'), status: convHave ? 'good' : 'info',
      detail: t('agentReady.conventions.detail', { have: convHave }),
      fix: convHave === 0 ? t('agentReady.conventions.fix') : null },
  ];

  // Punteggio informativo: quota di segnali dichiarati. Non entra nell'overall.
  const declared = (usage.source ? 1 : 0) + (mcp.api ? 1 : 0) + (convHave ? 1 : 0) + (filtered ? 0 : 1);
  return { informational: true, score: clamp(pct(declared, 4)), checks };
}
export const AGENT_READY_LABEL = 'Standard d\'avanguardia per gli agenti';
```

- [ ] **Step 5: Chiavi italiane in `src/messages/it.js`**

```js
  // agentReady — standard d'avanguardia (informativo)
  'category.agentReady': 'Standard d\'avanguardia per gli agenti',
  'agentReady.usage.name': 'AIPREF Content-Usage (IETF)',
  'agentReady.usage.detail.ok': 'dichiarato via {source}: {raw}',
  'agentReady.usage.detail.none': 'nessuna preferenza AIPREF dichiarata',
  'agentReady.usage.fix': 'Dichiara le preferenze con Content-Usage (es. train-ai=n, search=y) nell\'header HTTP o nel robots.txt: è lo standard IETF che sostituisce TDMRep e Content-Signal',
  'agentReady.botauth.name': 'Web Bot Auth (RFC 9421)',
  'agentReady.botauth.detail.filtered': 'il sito filtra per user-agent: {aiOk}/{aiTotal} user-agent AI ricevono la pagina, il browser sì',
  'agentReady.botauth.detail.uniform': 'nessuna differenza fra user-agent browser e AI',
  'agentReady.botauth.limit': 'Beacon non può verificare dall\'esterno se il tuo edge verifica le firme: è il bot che firma, non il sito',
  'agentReady.botauth.fix': 'Sostituisci i blocchi per user-agent con la verifica della firma (header Signature-Agent + JWKS): il nome dell\'user-agent è dichiarabile da chiunque, la firma no',
  'agentReady.webmcp.name': 'WebMCP (W3C, sperimentale)',
  'agentReady.webmcp.detail.ok': 'tool registrati nella pagina ({api})',
  'agentReady.webmcp.detail.none': 'nessun tool WebMCP dichiarato',
  'agentReady.webmcp.detail.norender': 'non valutabile senza rendering JS (usa --js)',
  'agentReady.webmcp.deprecated': 'API deprecata da Chrome 150: passa a document.modelContext',
  'agentReady.webmcp.fix': 'Sperimentale: esponi le azioni del sito agli agenti con document.modelContext.registerTool()',
  'agentReady.conventions.name': 'Convenzioni di fatto (skill.md, mcp.json, agent-skills)',
  'agentReady.conventions.detail': '{have}/3 presenti',
  'agentReady.conventions.fix': 'Opzionale: sono convenzioni di fatto, non standard — utili se vuoi essere leggibile dagli agenti che le adottano',
```

- [ ] **Step 6: Raccogliere i dati in `audit.js` (entrambe le funzioni)**

Import (riga 10): aggiungere `analyzeAgentReady, parseContentUsage, detectWebmcp`.

In `audit()`, dopo il blocco `rights` (riga 62), aggiungere:

```js
  // standard d'avanguardia (informativi): AIPREF, Web Bot Auth (diagnostico), WebMCP
  const agentReady = analyzeAgentReady({
    contentUsage: parseContentUsage(page.headers?.get?.('content-usage'), robotsTxt),
    botAuth: {
      browserOk: page.ok,
      aiOk: Object.values(liveFetch).filter((r) => r.ok).length,
      aiTotal: Object.keys(liveFetch).length,
    },
    webmcp: { rendered: !!renderedHtml, api: detectWebmcp(renderedHtml || html) },
    conventions: { skillMd: files.skillMd, mcpJson: files.mcpJson, agentSkills: files.agentSkills },
  }, L);
```

**Attenzione all'ordine:** `renderedHtml` è definito a riga 69, dopo il blocco `rights`. Spostare quindi questo blocco **subito dopo** la riga `const renderedHtml = render.ok ? render.html : null;` e prima di `// 6) analizzatori`.

Aggiungere `agentReady` al return di `audit()`, accanto a `rights`:

```js
  return { url, host, lang: L, profile: PROFILE, fetchedOk: page.ok, overall, categories: results, rights, agentReady, tech, files, html, notice, render: { active: renderJs, ok: render.ok, reason: render.reason } };
```

In `auditHtmlSnapshot()`, dopo il blocco `rights` (riga 141):

```js
  // Su snapshot non ci sono header HTTP né fetch live reali: AIPREF si legge solo
  // dal robots.txt e Web Bot Auth non è diagnosticabile (liveFetch è simulato).
  const agentReady = analyzeAgentReady({
    contentUsage: parseContentUsage(null, robotsTxt),
    botAuth: { browserOk: true, aiOk: LIVE_UA.length, aiTotal: LIVE_UA.length },
    webmcp: { rendered: false, api: detectWebmcp(html) },
    conventions: { skillMd: files.skillMd, mcpJson: files.mcpJson, agentSkills: files.agentSkills },
  }, L);
```

e nel return, accanto a `rights,`: `agentReady,`.

- [ ] **Step 7: Stampare la categoria informativa nella CLI**

In `audit.js`, dentro `printReport(r)` dopo il ciclo delle categorie pesate (riga 251):

```js
  for (const [label, cat] of [['Standard d\'avanguardia', r.agentReady], ['Segnali e diritti AI', r.rights], ['Fondamentali tecnici', r.tech]]) {
    if (!cat) continue;
    console.log(`${C.dim}${label} — informativo, non incide sul punteggio${C.reset}`);
    for (const c of cat.checks) console.log(`  ${C[c.status] || ''}${dot[c.status]}${C.reset} ${c.name} ${C.dim}— ${c.detail}${C.reset}`);
    console.log('');
  }
```

*(Se `printReport` già stampa `rights` e `tech` altrove, sostituire quel codice con questo ciclo invece di duplicarlo.)*

- [ ] **Step 8: Eseguire i test**

Run: `npm test`
Expected: PASS (a parte la parità dizionari, Task 9).

- [ ] **Step 9: Verifica su un sito reale**

Run: `node audit.js https://cloudflare.com --js`
Expected: nel blocco informativo compare «AIPREF Content-Usage» e «Web Bot Auth» con la frase sul limite di misura; WebMCP risulta assente o non valutabile senza `--js`.

- [ ] **Step 10: Commit**

```bash
git add src/lib.js src/analyzers.js audit.js src/messages/it.js test.js
git commit -m "feat(agentReady): categoria informativa per gli standard d'avanguardia

AIPREF Content-Usage (header + robots), Web Bot Auth come check diagnostico
che dichiara il proprio limite di misura, WebMCP per rilevazione testuale,
convenzioni di fatto (skill.md, mcp.json, agent-skills). Fuori da
CATEGORY_LABELS: non esiste evidenza che correlino con le citazioni.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 6: `analyzeAgentFiles` ricomposta

`llms.txt` valeva ~23 punti su 100 di una categoria pesata 0.20: il 4,6% del punteggio finale dipendeva da un file che il 97% delle volte nessuno legge. Ora la categoria pesa 0.05 e il punteggio si fa su ciò che ha un effetto verificabile.

**Files:**
- Modify: `src/analyzers.js:36-56`
- Modify: `src/messages/it.js` (chiavi `agentFiles.*`: due nuove, due rimosse)
- Test: `test.js:115-120` (aggiornare il blocco esistente)

**Interfaces:**
- Consumes: `files: { robotsTxt, sitemap, llmsTxt, ... }` (invariato — le convenzioni ora le legge `analyzeAgentReady`)
- Produces: `analyzeAgentFiles(files, lang) → { score, checks }` con lo score calcolato su `robotsTxt` e `sitemap` (50/50) e `llms.txt` come check informativo non contributivo

- [ ] **Step 1: Aggiornare gli assert esistenti e aggiungerne**

Sostituire il blocco `test.js:115-120` con:

```js
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
  ok(conLlms.checks.length === 2, 'agentFiles: due check — le convenzioni si sono spostate in agentReady');
}
```

- [ ] **Step 2: Eseguire i test e verificarne il fallimento**

Run: `npm test`
Expected: FAIL — `agentFiles: robots + sitemap = 100 anche senza llms.txt (avuto 47)`.

- [ ] **Step 3: Riscrivere l'analizzatore**

`src/analyzers.js:35-56` diventa:

```js
// ② FILE PER AGENTI E AI — scopribilità reale, non file di moda.
// Il punteggio sta su robots.txt e sitemap.xml: sono i due file che i crawler di
// retrieval usano davvero per scoprire le URL (ed è la base di IndexNow per
// Bing/Copilot). llms.txt resta visibile come check informativo: misurato su
// 137.210 domini con traffico reale, il 97% dei file non viene mai letto (Ahrefs);
// SE Ranking, ~300.000 domini: zero correlazione con le citazioni; Google dichiara
// di non leggerlo. Otterly l'ha rimosso dal proprio audit dopo aver analizzato
// milioni di citazioni. Le convenzioni di fatto (skill.md, .well-known/mcp.json,
// agent-skills) sono in analyzeAgentReady, dove non contano per il voto.
export function analyzeAgentFiles(files, lang = 'it') {
  const t = makeT(lang);
  const base = ['robotsTxt', 'sitemap'];
  const baseHave = base.filter((k) => files[k]).length;
  const score = clamp(pct(baseHave, base.length));
  return {
    score,
    checks: [
      { name: t('agentFiles.base.name'), status: baseHave === 2 ? 'good' : baseHave === 1 ? 'warn' : 'crit',
        detail: t('agentFiles.base.detail', { have: baseHave }),
        fix: baseHave < 2 ? t('agentFiles.base.fix') : null },
      // Informativo dentro una categoria pesata: compare nell'elenco, non nello score.
      { name: t('agentFiles.llms.name'), status: 'info',
        detail: (files.llmsTxt ? t('agentFiles.llms.detail.ok') : t('agentFiles.llms.detail.none')) + ' — ' + t('agentFiles.llms.note') },
    ],
  };
}
```

- [ ] **Step 4: Aggiornare le chiavi in `src/messages/it.js`**

Sostituire il gruppo `agentFiles.*` con:

```js
  'agentFiles.base.name': 'File di scopribilità (robots.txt, sitemap.xml)',
  'agentFiles.base.detail': '{have}/2 presenti',
  'agentFiles.base.fix': 'Pubblica sitemap.xml e dichiaralo nel robots.txt: è così che i crawler di retrieval scoprono le tue URL',
  'agentFiles.llms.name': 'llms.txt (convenzione, non standard)',
  'agentFiles.llms.detail.ok': 'presente',
  'agentFiles.llms.detail.none': 'assente',
  'agentFiles.llms.note': 'non incide sul punteggio: su 137.210 domini misurati il 97% dei file llms.txt non viene mai letto. Utile come indice per gli assistenti di codice, non per le citazioni',
```

Rimuovere `agentFiles.base.missingLlms`, `agentFiles.emerging.name`, `agentFiles.emerging.detail`, `agentFiles.emerging.fix` da **tutti e sei** i file `src/messages/*.js` (l'italiano è il riferimento della parità: lasciarle nelle altre lingue non rompe il test, ma è codice morto).

- [ ] **Step 5: Eseguire i test**

Run: `npm test`
Expected: PASS. Verificare anche che `src/llmstxt.js` e il flag `--llms` continuino a funzionare: il generatore resta, cambia solo il modo in cui il file viene *valutato*.

Run: `node audit.js lucarimediotti.com --llms | head -20`
Expected: il llms.txt generato viene stampato come prima.

- [ ] **Step 6: Commit**

```bash
git add src/analyzers.js src/messages test.js
git commit -m "refactor(agentFiles): il punteggio segue la scopribilita, non i file di moda

robots.txt e sitemap.xml fanno il voto (50/50); llms.txt resta come check
informativo con la nota sul suo uso reale e senza un fix che promette
citazioni. Le convenzioni di fatto si spostano in agentReady.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 7: `analyzeAccess` — separare training da retrieval live

Bloccare GPTBot non riduce le citazioni di oggi: gli archivi di training sono già raccolti e retroattivi. Bloccare OAI-SearchBot o PerplexityBot sì: sono quelli che leggono la pagina nel momento in cui un utente fa la domanda. Nel report la differenza va detta.

**Files:**
- Modify: `src/lib.js` (due costanti nuove dopo `LIVE_UA`, riga 16)
- Modify: `src/analyzers.js:13-33`
- Modify: `src/messages/it.js`
- Test: `test.js:105-114` (blocco `analyzeAccess` esistente) + invariante nuova

**Interfaces:**
- Consumes: `robotsAllowed`, `liveFetch` (invariati)
- Produces: `TRAINING_CRAWLERS: string[]`, `RETRIEVAL_CRAWLERS: string[]` da `src/lib.js`; `analyzeAccess` restituisce tre check invece di due

- [ ] **Step 1: Scrivere gli assert, partendo dall'invariante**

```js
// access: la separazione fra training e retrieval è una tassonomia — se un bot nuovo
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
  ok(aT.checks.length === 3, 'access: tre check — training, retrieval, fetch live');
  const tr = aT.checks.find((c) => c.name.toLowerCase().includes('training'));
  ok(tr && /archivi|già raccolt/i.test(tr.detail), 'access: il check training spiega che il blocco non riduce le citazioni di oggi');
  ok(!tr.fix, 'access: nessun fix che chiede di aprire i bot di training — è una scelta del sito');

  // liveFetch pesa più del robots: un WAF che blocca tutto affonda il punteggio
  // anche con un robots.txt perfetto.
  const liveKo = {}; for (const ua of LIVE_UA) liveKo[ua] = { ok: false };
  const aperto = analyzeAccess({ robotsAllowed: tutti, liveFetch: liveKo });
  ok(aperto.score <= 55, 'access: robots aperto ma WAF che blocca → punteggio basso: ' + aperto.score);
}
```

Import: aggiungere `AI_CRAWLERS, LIVE_UA, TRAINING_CRAWLERS, RETRIEVAL_CRAWLERS` ai nomi importati da `./src/lib.js`.

- [ ] **Step 2: Eseguire i test e verificarne il fallimento**

Run: `npm test`
Expected: FAIL — `does not provide an export named 'TRAINING_CRAWLERS'`.

- [ ] **Step 3: Classificare i crawler in `src/lib.js`**

Dopo `LIVE_UA` (riga 16):

```js
// Le due famiglie hanno conseguenze opposte e il report deve dirlo.
// Training: alimentano i modelli. Bloccarli NON riduce le citazioni di oggi —
// gli archivi sono già raccolti e il training è retroattivo.
// Retrieval live: leggono la pagina nel momento in cui un utente fa la domanda.
// Bloccarli significa non essere citabili in tempo reale (BuzzStream, 4M citazioni).
// L'unione deve coprire AI_CRAWLERS: un bot non classificato è un report che mente
// per omissione (invariante verificata in test.js).
export const TRAINING_CRAWLERS = [
  'GPTBot', 'ClaudeBot', 'anthropic-ai', 'Google-Extended', 'CCBot',
  'Bytespider', 'cohere-ai', 'Meta-ExternalAgent', 'Amazonbot',
];
export const RETRIEVAL_CRAWLERS = [
  'OAI-SearchBot', 'ChatGPT-User', 'Claude-User', 'PerplexityBot', 'Googlebot',
  'Bingbot', 'Applebot', 'DuckAssistBot', 'YouBot', 'MistralAI-User',
];
```

- [ ] **Step 4: Riscrivere `analyzeAccess`**

`src/analyzers.js:13-33` diventa:

```js
// ① ACCESSO AI — chi può leggere il sito, distinguendo il training dal retrieval live.
// Il fetch live pesa più del robots.txt: misurato su 4M citazioni (BuzzStream), il 95%
// delle pagine citate bloccava GPTBot nel robots — la riga di testo conta meno di
// quello che il server fa davvero quando un user-agent AI chiede la pagina.
export function analyzeAccess({ robotsAllowed, liveFetch }, lang = 'it') {
  const t = makeT(lang);
  const groupStats = (list) => {
    const present = list.filter((ua) => ua in robotsAllowed);
    const allowed = present.filter((ua) => robotsAllowed[ua]);
    return { allowed: allowed.length, total: present.length || 1, blocked: present.filter((ua) => !robotsAllowed[ua]) };
  };
  const train = groupStats(TRAINING_CRAWLERS);
  const retr = groupStats(RETRIEVAL_CRAWLERS);
  const liveTotal = Object.keys(liveFetch).length || 1;
  const liveOk = Object.values(liveFetch).filter((r) => r.ok).length;

  // 45 fetch live + 35 retrieval + 20 training: il peso segue la conseguenza.
  const score = clamp(
    0.45 * pct(liveOk, liveTotal) +
    0.35 * pct(retr.allowed, retr.total) +
    0.20 * pct(train.allowed, train.total)
  );
  const st = (p) => (p >= 0.9 ? 'good' : p >= 0.5 ? 'warn' : 'crit');
  const names = (l) => (l.length ? l.slice(0, 4).join(', ') + (l.length > 4 ? '…' : '') : '—');

  return {
    score,
    checks: [
      { name: t('access.retrieval.name'), status: st(retr.allowed / retr.total),
        detail: t('access.retrieval.detail', { allowed: retr.allowed, total: retr.total, blocked: names(retr.blocked) }),
        fix: retr.allowed < retr.total ? t('access.retrieval.fix') : null },
      // Nessun fix: aprire i bot di training è una scelta legittima del sito, non un
      // difetto da correggere. Il check dice solo che cosa comporta davvero.
      { name: t('access.training.name'), status: 'info',
        detail: t('access.training.detail', { allowed: train.allowed, total: train.total }) + ' — ' + t('access.training.note') },
      { name: t('access.live.name'), status: st(liveOk / liveTotal),
        detail: t('access.live.detail', { ok: liveOk, total: liveTotal }),
        fix: liveOk < liveTotal ? t('access.live.fix') : null },
    ],
  };
}
```

Estendere l'import di `src/analyzers.js` da `./lib.js` con `TRAINING_CRAWLERS, RETRIEVAL_CRAWLERS`.

- [ ] **Step 5: Chiavi in `src/messages/it.js`**

Le chiavi `access.live.name`, `access.live.detail` e `access.live.fix` **esistono già** in tutte e sei le lingue (`it.js:31-33` e omologhe): non ricrearle, il terzo check le riusa così come sono. Rimuovere invece `access.robots.name`, `access.robots.detail`, `access.robots.fix` (da tutti e sei i file) e aggiungere:

```js
  'access.retrieval.name': 'Crawler di retrieval live ammessi',
  'access.retrieval.detail': '{allowed}/{total} ammessi nel robots.txt (bloccati: {blocked})',
  'access.retrieval.fix': 'Ammetti OAI-SearchBot, ChatGPT-User, Claude-User e PerplexityBot: sono quelli che leggono la pagina quando un utente chiede di te',
  'access.training.name': 'Crawler di training ammessi',
  'access.training.detail': '{allowed}/{total} ammessi nel robots.txt',
  'access.training.note': 'bloccarli è una scelta legittima e non riduce le citazioni di oggi: gli archivi di training sono già raccolti. Google-Extended esclude solo il training di Gemini e Vertex AI, non tocca ranking né AI Overviews',
```

- [ ] **Step 6: Eseguire i test**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Verifica su un sito che blocca i bot AI**

Run: `node audit.js https://www.nytimes.com`
Expected: il check «Crawler di retrieval live ammessi» mostra i bot bloccati per nome; il check training è informativo e non porta un fix.

- [ ] **Step 8: Commit**

```bash
git add src/lib.js src/analyzers.js src/messages/it.js test.js
git commit -m "feat(access): separa i crawler di training da quelli di retrieval live

Bloccare GPTBot non riduce le citazioni di oggi (archivi retroattivi);
bloccare OAI-SearchBot o PerplexityBot si. Il fetch live pesa piu del
robots.txt: sui 4M di citazioni misurati da BuzzStream il 95% delle pagine
citate bloccava GPTBot nel robots. Un'invariante nei test impedisce che un
bot nuovo resti non classificato.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 8: `history.js` — il profilo nello snapshot e la guardia nel diff

Senza questo task il primo audit dopo il cambio pesi mostra al cliente un crollo di punteggio che non corrisponde a nessuna modifica del suo sito.

**Files:**
- Modify: `src/history.js:12-29`
- Modify: `web/app/report/page.jsx:105-115` (avviso nella UI)
- Test: `test.js:208-218` (estendere il blocco esistente)

**Interfaces:**
- Consumes: `suite.geo.profile` (Task 1)
- Produces: `snapshot()` restituisce anche `profile: string|null`; `diff()` restituisce `{ …delta, profileChanged?: { prev, curr } }` **senza** `geo` quando i profili differiscono

- [ ] **Step 1: Aggiungere gli assert**

Dopo il blocco `history.js` esistente (dopo `test.js:218`):

```js
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
}
```

- [ ] **Step 2: Eseguire i test e verificarne il fallimento**

Run: `npm test`
Expected: FAIL — `history: il profilo pesi entra nello snapshot` (undefined).

- [ ] **Step 3: Implementare**

`src/history.js:12-29` diventa:

```js
// Estrae uno snapshot compatto (solo i punteggi) dal risultato di auditAll().
export function snapshot(suite, ts) {
  const geo = suite.geo && !suite.geo.error ? suite.geo.overall : null;
  const a11y = suite.a11y && !suite.a11y.error && suite.a11y.result ? suite.a11y.result.score : null;
  const axe = suite.a11y && suite.a11y.axe && suite.a11y.axe.ok ? suite.a11y.axe.counts.violations : null;
  const perf = suite.perf && suite.perf.ok ? suite.perf.result.score : null;
  // Il profilo pesi viaggia con il punteggio: due voti calcolati con pesi diversi
  // non sono confrontabili, e un delta che non lo dice fa passare un cambio di
  // taratura per un peggioramento del sito.
  const profile = suite.geo && !suite.geo.error ? (suite.geo.profile || null) : null;
  return { ts, host: suite.host, url: suite.url, geo, a11y, axe, perf, profile };
}

// Delta tra due snapshot. Per i punteggi: positivo = meglio. Per axe (violazioni):
// negativo = meglio. Se il profilo pesi è cambiato, il delta GEO non viene calcolato:
// accessibilità e performance restano confrontabili perché non dipendono da quei pesi.
export function diff(prev, curr) {
  if (!prev || !curr) return null;
  const d = {};
  const sameProfile = (prev.profile || null) === (curr.profile || null);
  if (!sameProfile) d.profileChanged = { prev: prev.profile || null, curr: curr.profile || null };
  for (const k of ['geo', 'a11y', 'perf']) {
    if (k === 'geo' && !sameProfile) continue;
    if (typeof prev[k] === 'number' && typeof curr[k] === 'number') d[k] = curr[k] - prev[k];
  }
  if (typeof prev.axe === 'number' && typeof curr.axe === 'number') d.axe = curr.axe - prev.axe;
  return d;
}
```

- [ ] **Step 4: Mostrarlo nella UI del report**

In `web/app/report/page.jsx`, dentro il blocco `res.history?.previous && res.history.delta` (riga 105), prima della `<ul>`:

```jsx
                {res.history.delta.profileChanged && (
                  <p className="info" style={{ margin: '4px 0 8px' }}>
                    {t('Il profilo dei pesi è cambiato')} ({res.history.delta.profileChanged.prev || '—'} → {res.history.delta.profileChanged.curr}): {t('il punteggio GEO non è confrontabile con la scansione precedente.')}
                  </p>
                )}
```

Aggiungere le due frasi come chiavi nei cinque file `web/app/translations/*.js`:

```js
// en.js
  "Il profilo dei pesi è cambiato": "The weight profile changed",
  "il punteggio GEO non è confrontabile con la scansione precedente.": "the GEO score is not comparable with the previous scan.",
// de.js
  "Il profilo dei pesi è cambiato": "Das Gewichtungsprofil hat sich geändert",
  "il punteggio GEO non è confrontabile con la scansione precedente.": "der GEO-Score ist nicht mit dem vorherigen Scan vergleichbar.",
// fr.js
  "Il profilo dei pesi è cambiato": "Le profil de pondération a changé",
  "il punteggio GEO non è confrontabile con la scansione precedente.": "le score GEO n'est pas comparable avec l'analyse précédente.",
// es.js
  "Il profilo dei pesi è cambiato": "El perfil de pesos ha cambiado",
  "il punteggio GEO non è confrontabile con la scansione precedente.": "la puntuación GEO no es comparable con el análisis anterior.",
// pt.js
  "Il profilo dei pesi è cambiato": "O perfil de pesos mudou",
  "il punteggio GEO non è confrontabile con la scansione precedente.": "a pontuação GEO não é comparável com a análise anterior.",
```

- [ ] **Step 5: Eseguire i test**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/history.js web/app/report/page.jsx web/app/translations test.js
git commit -m "feat(history): il profilo pesi nello snapshot, delta GEO sospeso se cambia

Senza questa guardia il primo audit dopo il cambio pesi mostrerebbe al
cliente un crollo di punteggio che non corrisponde a nessuna modifica del suo
sito. Accessibilita e performance restano confrontabili.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 9: i18n nelle cinque lingue restanti e copy della UI

Il test di parità (`test.js:896-903`) è la rete: fallisce finché una chiave italiana non ha la sua traduzione. Questo task lo riporta verde.

**Files:**
- Modify: `src/messages/en.js`, `de.js`, `fr.js`, `es.js`, `pt.js`
- Modify: `web/app/page.jsx:177` (copy «sei categorie»)
- Modify: `web/app/translations/{en,de,fr,es,pt}.js`
- Test: `test.js` (già presente il test di parità)

**Interfaces:**
- Consumes: le chiavi italiane definite nei Task 1, 3, 5, 6, 7
- Produces: sei cataloghi con lo stesso insieme di chiavi

- [ ] **Step 1: Elencare le chiavi da tradurre**

Run:
```bash
node -e "
import('./src/messages/it.js').then(async ({ it }) => {
  const { en } = await import('./src/messages/en.js');
  const mancanti = Object.keys(it).filter((k) => !(k in en));
  console.log(mancanti.length + ' chiavi da tradurre:');
  for (const k of mancanti) console.log(k + ' = ' + it[k]);
});
"
```
Expected: circa 45 chiavi (`answerability.*`, `agentReady.*`, `agentFiles.llms.*`, `access.retrieval.*`, `access.training.*`, `category.answerability`, `category.agentReady`, `report.profile`).

- [ ] **Step 2: Tradurre in `en.js`**

```js
  'category.answerability': 'AI answer readiness',
  'category.agentReady': 'Frontier standards for agents',
  'answerability.direct.name': 'Direct answer after the heading',
  'answerability.direct.detail': 'first sentence after H2/H3: {median} words (median over {sections} sections)',
  'answerability.direct.fix': 'Open each section with an answer under 30 words, then elaborate',
  'answerability.blocks.name': 'Extractable blocks (lists, tables)',
  'answerability.blocks.detail': '{blocks} blocks across {words} words ({lists} lists, {tables} tables)',
  'answerability.blocks.fix': 'Turn enumerations into lists and comparisons into tables with headers',
  'answerability.paras.name': 'Digestible paragraphs',
  'answerability.paras.detail': '{long}/{total} paragraphs over 120 words',
  'answerability.paras.fix': 'Break up long paragraphs: one idea per paragraph, under 120 words',
  'answerability.questions.name': 'Question-shaped headings',
  'answerability.questions.detail': '{have}/{total} H2-H3 headings phrased as questions (page language: {lang})',
  'answerability.questions.fix': 'Rephrase headings as the questions people actually type',
  'answerability.evidence.name': 'Citable evidence',
  'answerability.evidence.detail': '{count} items: {numbers} data points, {quotes} quotations, {links} source links',
  'answerability.evidence.fix': 'Add figures with units, quotations and links to sources',
  'answerability.unmeasured.name': 'Not enough content to measure',
  'answerability.unmeasured.detail': '{words} words: below 300 this category leaves the score instead of penalising the page',
  'agentFiles.base.name': 'Discoverability files (robots.txt, sitemap.xml)',
  'agentFiles.base.detail': '{have}/2 present',
  'agentFiles.base.fix': 'Publish sitemap.xml and declare it in robots.txt: that is how retrieval crawlers discover your URLs',
  'agentFiles.llms.name': 'llms.txt (convention, not a standard)',
  'agentFiles.llms.detail.ok': 'present',
  'agentFiles.llms.detail.none': 'absent',
  'agentFiles.llms.note': 'does not affect the score: across 137,210 measured domains, 97% of llms.txt files are never read. Useful as an index for coding assistants, not for citations',
  'access.retrieval.name': 'Live retrieval crawlers allowed',
  'access.retrieval.detail': '{allowed}/{total} allowed in robots.txt (blocked: {blocked})',
  'access.retrieval.fix': 'Allow OAI-SearchBot, ChatGPT-User, Claude-User and PerplexityBot: these read the page when a user asks about you',
  'access.training.name': 'Training crawlers allowed',
  'access.training.detail': '{allowed}/{total} allowed in robots.txt',
  'access.training.note': 'blocking them is a legitimate choice and does not reduce today\'s citations: training archives are already collected. Google-Extended only excludes Gemini and Vertex AI training, it does not touch ranking or AI Overviews',
  'agentReady.usage.name': 'AIPREF Content-Usage (IETF)',
  'agentReady.usage.detail.ok': 'declared via {source}: {raw}',
  'agentReady.usage.detail.none': 'no AIPREF preference declared',
  'agentReady.usage.fix': 'Declare your preferences with Content-Usage (e.g. train-ai=n, search=y) in the HTTP header or robots.txt: it is the IETF standard superseding TDMRep and Content-Signal',
  'agentReady.botauth.name': 'Web Bot Auth (RFC 9421)',
  'agentReady.botauth.detail.filtered': 'the site filters by user-agent: {aiOk}/{aiTotal} AI user-agents receive the page, the browser does',
  'agentReady.botauth.detail.uniform': 'no difference between browser and AI user-agents',
  'agentReady.botauth.limit': 'Beacon cannot verify from the outside whether your edge validates signatures: the bot signs, not the site',
  'agentReady.botauth.fix': 'Replace user-agent blocks with signature verification (Signature-Agent header + JWKS): anyone can claim a user-agent name, nobody can forge the signature',
  'agentReady.webmcp.name': 'WebMCP (W3C, experimental)',
  'agentReady.webmcp.detail.ok': 'tools registered on the page ({api})',
  'agentReady.webmcp.detail.none': 'no WebMCP tools declared',
  'agentReady.webmcp.detail.norender': 'not assessable without JS rendering (use --js)',
  'agentReady.webmcp.deprecated': 'API deprecated in Chrome 150: move to document.modelContext',
  'agentReady.webmcp.fix': 'Experimental: expose your site\'s actions to agents with document.modelContext.registerTool()',
  'agentReady.conventions.name': 'De facto conventions (skill.md, mcp.json, agent-skills)',
  'agentReady.conventions.detail': '{have}/3 present',
  'agentReady.conventions.fix': 'Optional: these are de facto conventions, not standards — useful if you want to be readable by the agents that adopt them',
```

- [ ] **Step 3: Tradurre in `de.js`**

```js
  'category.answerability': 'Antwortbereitschaft für KI',
  'category.agentReady': 'Zukunftsstandards für Agenten',
  'answerability.direct.name': 'Direkte Antwort nach der Überschrift',
  'answerability.direct.detail': 'erster Satz nach H2/H3: {median} Wörter (Median über {sections} Abschnitte)',
  'answerability.direct.fix': 'Beginne jeden Abschnitt mit einer Antwort unter 30 Wörtern, dann führe aus',
  'answerability.blocks.name': 'Extrahierbare Blöcke (Listen, Tabellen)',
  'answerability.blocks.detail': '{blocks} Blöcke auf {words} Wörter ({lists} Listen, {tables} Tabellen)',
  'answerability.blocks.fix': 'Wandle Aufzählungen in Listen und Vergleiche in Tabellen mit Kopfzeilen um',
  'answerability.paras.name': 'Verdauliche Absätze',
  'answerability.paras.detail': '{long}/{total} Absätze über 120 Wörter',
  'answerability.paras.fix': 'Teile lange Absätze auf: ein Gedanke pro Absatz, unter 120 Wörtern',
  'answerability.questions.name': 'Überschriften als Fragen',
  'answerability.questions.detail': '{have}/{total} H2-H3 als Frage formuliert (Sprache der Seite: {lang})',
  'answerability.questions.fix': 'Formuliere Überschriften als die Fragen, die Menschen wirklich eintippen',
  'answerability.evidence.name': 'Zitierfähige Belege',
  'answerability.evidence.detail': '{count} Elemente: {numbers} Daten, {quotes} Zitate, {links} Quellenlinks',
  'answerability.evidence.fix': 'Ergänze Zahlen mit Einheiten, Zitate und Links zu den Quellen',
  'answerability.unmeasured.name': 'Zu wenig Inhalt für eine Messung',
  'answerability.unmeasured.detail': '{words} Wörter: unter 300 verlässt diese Kategorie den Score, statt die Seite abzuwerten',
  'agentFiles.base.name': 'Dateien für die Auffindbarkeit (robots.txt, sitemap.xml)',
  'agentFiles.base.detail': '{have}/2 vorhanden',
  'agentFiles.base.fix': 'Veröffentliche sitemap.xml und verweise darauf in der robots.txt: so finden Retrieval-Crawler deine URLs',
  'agentFiles.llms.name': 'llms.txt (Konvention, kein Standard)',
  'agentFiles.llms.detail.ok': 'vorhanden',
  'agentFiles.llms.detail.none': 'nicht vorhanden',
  'agentFiles.llms.note': 'wirkt nicht auf den Score: von 137.210 gemessenen Domains werden 97% der llms.txt-Dateien nie gelesen. Nützlich als Index für Coding-Assistenten, nicht für Zitationen',
  'access.retrieval.name': 'Zugelassene Live-Retrieval-Crawler',
  'access.retrieval.detail': '{allowed}/{total} in der robots.txt zugelassen (blockiert: {blocked})',
  'access.retrieval.fix': 'Lasse OAI-SearchBot, ChatGPT-User, Claude-User und PerplexityBot zu: sie lesen die Seite, wenn jemand nach dir fragt',
  'access.training.name': 'Zugelassene Trainings-Crawler',
  'access.training.detail': '{allowed}/{total} in der robots.txt zugelassen',
  'access.training.note': 'sie zu blockieren ist eine legitime Entscheidung und senkt die heutigen Zitationen nicht: die Trainingsarchive sind längst gesammelt. Google-Extended schließt nur das Training von Gemini und Vertex AI aus, nicht Ranking oder AI Overviews',
  'agentReady.usage.name': 'AIPREF Content-Usage (IETF)',
  'agentReady.usage.detail.ok': 'deklariert über {source}: {raw}',
  'agentReady.usage.detail.none': 'keine AIPREF-Präferenz deklariert',
  'agentReady.usage.fix': 'Deklariere deine Präferenzen mit Content-Usage (z. B. train-ai=n, search=y) im HTTP-Header oder in der robots.txt: der IETF-Standard, der TDMRep und Content-Signal ablöst',
  'agentReady.botauth.name': 'Web Bot Auth (RFC 9421)',
  'agentReady.botauth.detail.filtered': 'die Website filtert nach User-Agent: {aiOk}/{aiTotal} KI-User-Agents erhalten die Seite, der Browser schon',
  'agentReady.botauth.detail.uniform': 'kein Unterschied zwischen Browser- und KI-User-Agents',
  'agentReady.botauth.limit': 'Beacon kann von außen nicht prüfen, ob deine Edge Signaturen verifiziert: es signiert der Bot, nicht die Website',
  'agentReady.botauth.fix': 'Ersetze User-Agent-Sperren durch Signaturprüfung (Signature-Agent-Header + JWKS): einen Namen kann jeder behaupten, die Signatur nicht',
  'agentReady.webmcp.name': 'WebMCP (W3C, experimentell)',
  'agentReady.webmcp.detail.ok': 'Tools auf der Seite registriert ({api})',
  'agentReady.webmcp.detail.none': 'keine WebMCP-Tools deklariert',
  'agentReady.webmcp.detail.norender': 'ohne JS-Rendering nicht bewertbar (nutze --js)',
  'agentReady.webmcp.deprecated': 'API seit Chrome 150 veraltet: wechsle zu document.modelContext',
  'agentReady.webmcp.fix': 'Experimentell: mache die Aktionen deiner Website für Agenten verfügbar mit document.modelContext.registerTool()',
  'agentReady.conventions.name': 'De-facto-Konventionen (skill.md, mcp.json, agent-skills)',
  'agentReady.conventions.detail': '{have}/3 vorhanden',
  'agentReady.conventions.fix': 'Optional: das sind De-facto-Konventionen, keine Standards — nützlich, wenn du für die Agenten lesbar sein willst, die sie nutzen',
```

- [ ] **Step 4: Tradurre in `fr.js`**

```js
  'category.answerability': 'Prêt à répondre pour les IA',
  'category.agentReady': 'Standards d\'avant-garde pour les agents',
  'answerability.direct.name': 'Réponse directe après le titre',
  'answerability.direct.detail': 'première phrase après H2/H3 : {median} mots (médiane sur {sections} sections)',
  'answerability.direct.fix': 'Ouvre chaque section par une réponse de moins de 30 mots, puis développe',
  'answerability.blocks.name': 'Blocs extractibles (listes, tableaux)',
  'answerability.blocks.detail': '{blocks} blocs pour {words} mots ({lists} listes, {tables} tableaux)',
  'answerability.blocks.fix': 'Transforme les énumérations en listes et les comparaisons en tableaux avec en-têtes',
  'answerability.paras.name': 'Paragraphes digestes',
  'answerability.paras.detail': '{long}/{total} paragraphes de plus de 120 mots',
  'answerability.paras.fix': 'Découpe les paragraphes longs : une idée par paragraphe, sous 120 mots',
  'answerability.questions.name': 'Titres sous forme de question',
  'answerability.questions.detail': '{have}/{total} titres H2-H3 formulés en question (langue de la page : {lang})',
  'answerability.questions.fix': 'Reformule les titres comme les questions que les gens tapent vraiment',
  'answerability.evidence.name': 'Preuves citables',
  'answerability.evidence.detail': '{count} éléments : {numbers} données, {quotes} citations, {links} liens vers des sources',
  'answerability.evidence.fix': 'Ajoute des chiffres avec unités, des citations et des liens vers les sources',
  'answerability.unmeasured.name': 'Contenu insuffisant pour la mesure',
  'answerability.unmeasured.detail': '{words} mots : sous 300, cette catégorie sort du score au lieu de pénaliser la page',
  'agentFiles.base.name': 'Fichiers de découvrabilité (robots.txt, sitemap.xml)',
  'agentFiles.base.detail': '{have}/2 présents',
  'agentFiles.base.fix': 'Publie sitemap.xml et déclare-le dans robots.txt : c\'est ainsi que les crawlers de retrieval découvrent tes URL',
  'agentFiles.llms.name': 'llms.txt (convention, pas un standard)',
  'agentFiles.llms.detail.ok': 'présent',
  'agentFiles.llms.detail.none': 'absent',
  'agentFiles.llms.note': 'n\'influence pas le score : sur 137 210 domaines mesurés, 97 % des fichiers llms.txt ne sont jamais lus. Utile comme index pour les assistants de code, pas pour les citations',
  'access.retrieval.name': 'Crawlers de retrieval live autorisés',
  'access.retrieval.detail': '{allowed}/{total} autorisés dans robots.txt (bloqués : {blocked})',
  'access.retrieval.fix': 'Autorise OAI-SearchBot, ChatGPT-User, Claude-User et PerplexityBot : ce sont eux qui lisent la page quand un utilisateur pose une question sur toi',
  'access.training.name': 'Crawlers d\'entraînement autorisés',
  'access.training.detail': '{allowed}/{total} autorisés dans robots.txt',
  'access.training.note': 'les bloquer est un choix légitime et ne réduit pas les citations d\'aujourd\'hui : les archives d\'entraînement sont déjà constituées. Google-Extended n\'exclut que l\'entraînement de Gemini et Vertex AI, sans toucher au ranking ni aux AI Overviews',
  'agentReady.usage.name': 'AIPREF Content-Usage (IETF)',
  'agentReady.usage.detail.ok': 'déclaré via {source} : {raw}',
  'agentReady.usage.detail.none': 'aucune préférence AIPREF déclarée',
  'agentReady.usage.fix': 'Déclare tes préférences avec Content-Usage (ex. train-ai=n, search=y) dans l\'en-tête HTTP ou robots.txt : c\'est le standard IETF qui remplace TDMRep et Content-Signal',
  'agentReady.botauth.name': 'Web Bot Auth (RFC 9421)',
  'agentReady.botauth.detail.filtered': 'le site filtre par user-agent : {aiOk}/{aiTotal} user-agents IA reçoivent la page, le navigateur oui',
  'agentReady.botauth.detail.uniform': 'aucune différence entre user-agents navigateur et IA',
  'agentReady.botauth.limit': 'Beacon ne peut pas vérifier de l\'extérieur si ton edge valide les signatures : c\'est le bot qui signe, pas le site',
  'agentReady.botauth.fix': 'Remplace les blocages par user-agent par la vérification de signature (en-tête Signature-Agent + JWKS) : un nom se déclare, une signature ne se falsifie pas',
  'agentReady.webmcp.name': 'WebMCP (W3C, expérimental)',
  'agentReady.webmcp.detail.ok': 'outils enregistrés dans la page ({api})',
  'agentReady.webmcp.detail.none': 'aucun outil WebMCP déclaré',
  'agentReady.webmcp.detail.norender': 'non évaluable sans rendu JS (utilise --js)',
  'agentReady.webmcp.deprecated': 'API dépréciée depuis Chrome 150 : passe à document.modelContext',
  'agentReady.webmcp.fix': 'Expérimental : expose les actions de ton site aux agents avec document.modelContext.registerTool()',
  'agentReady.conventions.name': 'Conventions de fait (skill.md, mcp.json, agent-skills)',
  'agentReady.conventions.detail': '{have}/3 présents',
  'agentReady.conventions.fix': 'Optionnel : ce sont des conventions de fait, pas des standards — utiles si tu veux être lisible par les agents qui les adoptent',
```

- [ ] **Step 5: Tradurre in `es.js`**

```js
  'category.answerability': 'Listo para responder a las IA',
  'category.agentReady': 'Estándares de vanguardia para agentes',
  'answerability.direct.name': 'Respuesta directa tras el titular',
  'answerability.direct.detail': 'primera frase tras H2/H3: {median} palabras (mediana sobre {sections} secciones)',
  'answerability.direct.fix': 'Abre cada sección con una respuesta de menos de 30 palabras y después desarrolla',
  'answerability.blocks.name': 'Bloques extraíbles (listas, tablas)',
  'answerability.blocks.detail': '{blocks} bloques en {words} palabras ({lists} listas, {tables} tablas)',
  'answerability.blocks.fix': 'Convierte las enumeraciones en listas y las comparaciones en tablas con encabezados',
  'answerability.paras.name': 'Párrafos digeribles',
  'answerability.paras.detail': '{long}/{total} párrafos de más de 120 palabras',
  'answerability.paras.fix': 'Divide los párrafos largos: una idea por párrafo, por debajo de 120 palabras',
  'answerability.questions.name': 'Titulares en forma de pregunta',
  'answerability.questions.detail': '{have}/{total} titulares H2-H3 formulados como pregunta (idioma de la página: {lang})',
  'answerability.questions.fix': 'Reformula los titulares como las preguntas que la gente escribe de verdad',
  'answerability.evidence.name': 'Evidencia citable',
  'answerability.evidence.detail': '{count} elementos: {numbers} datos, {quotes} citas, {links} enlaces a fuentes',
  'answerability.evidence.fix': 'Añade cifras con unidades, citas y enlaces a las fuentes',
  'answerability.unmeasured.name': 'Contenido insuficiente para medir',
  'answerability.unmeasured.detail': '{words} palabras: por debajo de 300 esta categoría sale de la puntuación en lugar de penalizar la página',
  'agentFiles.base.name': 'Archivos de descubribilidad (robots.txt, sitemap.xml)',
  'agentFiles.base.detail': '{have}/2 presentes',
  'agentFiles.base.fix': 'Publica sitemap.xml y decláralo en robots.txt: así descubren tus URL los crawlers de retrieval',
  'agentFiles.llms.name': 'llms.txt (convención, no un estándar)',
  'agentFiles.llms.detail.ok': 'presente',
  'agentFiles.llms.detail.none': 'ausente',
  'agentFiles.llms.note': 'no influye en la puntuación: de 137.210 dominios medidos, el 97% de los archivos llms.txt nunca se lee. Útil como índice para asistentes de código, no para las citas',
  'access.retrieval.name': 'Crawlers de retrieval en vivo permitidos',
  'access.retrieval.detail': '{allowed}/{total} permitidos en robots.txt (bloqueados: {blocked})',
  'access.retrieval.fix': 'Permite OAI-SearchBot, ChatGPT-User, Claude-User y PerplexityBot: son los que leen la página cuando alguien pregunta por ti',
  'access.training.name': 'Crawlers de entrenamiento permitidos',
  'access.training.detail': '{allowed}/{total} permitidos en robots.txt',
  'access.training.note': 'bloquearlos es una decisión legítima y no reduce las citas de hoy: los archivos de entrenamiento ya están recogidos. Google-Extended solo excluye el entrenamiento de Gemini y Vertex AI, no afecta al ranking ni a los AI Overviews',
  'agentReady.usage.name': 'AIPREF Content-Usage (IETF)',
  'agentReady.usage.detail.ok': 'declarado vía {source}: {raw}',
  'agentReady.usage.detail.none': 'ninguna preferencia AIPREF declarada',
  'agentReady.usage.fix': 'Declara tus preferencias con Content-Usage (p. ej. train-ai=n, search=y) en la cabecera HTTP o en robots.txt: es el estándar IETF que sustituye a TDMRep y Content-Signal',
  'agentReady.botauth.name': 'Web Bot Auth (RFC 9421)',
  'agentReady.botauth.detail.filtered': 'el sitio filtra por user-agent: {aiOk}/{aiTotal} user-agents de IA reciben la página, el navegador sí',
  'agentReady.botauth.detail.uniform': 'ninguna diferencia entre user-agents de navegador y de IA',
  'agentReady.botauth.limit': 'Beacon no puede verificar desde fuera si tu edge valida las firmas: firma el bot, no el sitio',
  'agentReady.botauth.fix': 'Sustituye los bloqueos por user-agent por la verificación de firma (cabecera Signature-Agent + JWKS): un nombre lo declara cualquiera, la firma no se falsifica',
  'agentReady.webmcp.name': 'WebMCP (W3C, experimental)',
  'agentReady.webmcp.detail.ok': 'herramientas registradas en la página ({api})',
  'agentReady.webmcp.detail.none': 'ninguna herramienta WebMCP declarada',
  'agentReady.webmcp.detail.norender': 'no evaluable sin renderizado JS (usa --js)',
  'agentReady.webmcp.deprecated': 'API obsoleta desde Chrome 150: pasa a document.modelContext',
  'agentReady.webmcp.fix': 'Experimental: expón las acciones de tu sitio a los agentes con document.modelContext.registerTool()',
  'agentReady.conventions.name': 'Convenciones de facto (skill.md, mcp.json, agent-skills)',
  'agentReady.conventions.detail': '{have}/3 presentes',
  'agentReady.conventions.fix': 'Opcional: son convenciones de facto, no estándares — útiles si quieres ser legible para los agentes que las adoptan',
```

- [ ] **Step 6: Tradurre in `pt.js`**

```js
  'category.answerability': 'Pronto para responder às IA',
  'category.agentReady': 'Padrões de vanguarda para agentes',
  'answerability.direct.name': 'Resposta direta depois do título',
  'answerability.direct.detail': 'primeira frase depois de H2/H3: {median} palavras (mediana em {sections} secções)',
  'answerability.direct.fix': 'Abre cada secção com uma resposta com menos de 30 palavras e depois desenvolve',
  'answerability.blocks.name': 'Blocos extraíveis (listas, tabelas)',
  'answerability.blocks.detail': '{blocks} blocos em {words} palavras ({lists} listas, {tables} tabelas)',
  'answerability.blocks.fix': 'Transforma as enumerações em listas e as comparações em tabelas com cabeçalhos',
  'answerability.paras.name': 'Parágrafos digeríveis',
  'answerability.paras.detail': '{long}/{total} parágrafos com mais de 120 palavras',
  'answerability.paras.fix': 'Divide os parágrafos longos: uma ideia por parágrafo, abaixo das 120 palavras',
  'answerability.questions.name': 'Títulos em forma de pergunta',
  'answerability.questions.detail': '{have}/{total} títulos H2-H3 formulados como pergunta (idioma da página: {lang})',
  'answerability.questions.fix': 'Reformula os títulos como as perguntas que as pessoas realmente escrevem',
  'answerability.evidence.name': 'Evidência citável',
  'answerability.evidence.detail': '{count} elementos: {numbers} dados, {quotes} citações, {links} ligações a fontes',
  'answerability.evidence.fix': 'Acrescenta números com unidades, citações e ligações às fontes',
  'answerability.unmeasured.name': 'Conteúdo insuficiente para medir',
  'answerability.unmeasured.detail': '{words} palavras: abaixo de 300 esta categoria sai da pontuação em vez de penalizar a página',
  'agentFiles.base.name': 'Ficheiros de descoberta (robots.txt, sitemap.xml)',
  'agentFiles.base.detail': '{have}/2 presentes',
  'agentFiles.base.fix': 'Publica sitemap.xml e declara-o no robots.txt: é assim que os crawlers de retrieval descobrem os teus URL',
  'agentFiles.llms.name': 'llms.txt (convenção, não é um padrão)',
  'agentFiles.llms.detail.ok': 'presente',
  'agentFiles.llms.detail.none': 'ausente',
  'agentFiles.llms.note': 'não influencia a pontuação: em 137.210 domínios medidos, 97% dos ficheiros llms.txt nunca são lidos. Útil como índice para assistentes de código, não para as citações',
  'access.retrieval.name': 'Crawlers de retrieval ao vivo permitidos',
  'access.retrieval.detail': '{allowed}/{total} permitidos no robots.txt (bloqueados: {blocked})',
  'access.retrieval.fix': 'Permite OAI-SearchBot, ChatGPT-User, Claude-User e PerplexityBot: são estes que leem a página quando alguém pergunta por ti',
  'access.training.name': 'Crawlers de treino permitidos',
  'access.training.detail': '{allowed}/{total} permitidos no robots.txt',
  'access.training.note': 'bloqueá-los é uma escolha legítima e não reduz as citações de hoje: os arquivos de treino já foram recolhidos. Google-Extended exclui apenas o treino do Gemini e do Vertex AI, não afeta o ranking nem os AI Overviews',
  'agentReady.usage.name': 'AIPREF Content-Usage (IETF)',
  'agentReady.usage.detail.ok': 'declarado via {source}: {raw}',
  'agentReady.usage.detail.none': 'nenhuma preferência AIPREF declarada',
  'agentReady.usage.fix': 'Declara as tuas preferências com Content-Usage (ex. train-ai=n, search=y) no cabeçalho HTTP ou no robots.txt: é o padrão IETF que substitui TDMRep e Content-Signal',
  'agentReady.botauth.name': 'Web Bot Auth (RFC 9421)',
  'agentReady.botauth.detail.filtered': 'o site filtra por user-agent: {aiOk}/{aiTotal} user-agents de IA recebem a página, o navegador sim',
  'agentReady.botauth.detail.uniform': 'nenhuma diferença entre user-agents de navegador e de IA',
  'agentReady.botauth.limit': 'o Beacon não pode verificar do exterior se a tua edge valida as assinaturas: quem assina é o bot, não o site',
  'agentReady.botauth.fix': 'Substitui os bloqueios por user-agent pela verificação da assinatura (cabeçalho Signature-Agent + JWKS): qualquer um declara um nome, a assinatura não se falsifica',
  'agentReady.webmcp.name': 'WebMCP (W3C, experimental)',
  'agentReady.webmcp.detail.ok': 'ferramentas registadas na página ({api})',
  'agentReady.webmcp.detail.none': 'nenhuma ferramenta WebMCP declarada',
  'agentReady.webmcp.detail.norender': 'não avaliável sem renderização JS (usa --js)',
  'agentReady.webmcp.deprecated': 'API descontinuada no Chrome 150: passa para document.modelContext',
  'agentReady.webmcp.fix': 'Experimental: expõe as ações do teu site aos agentes com document.modelContext.registerTool()',
  'agentReady.conventions.name': 'Convenções de facto (skill.md, mcp.json, agent-skills)',
  'agentReady.conventions.detail': '{have}/3 presentes',
  'agentReady.conventions.fix': 'Opcional: são convenções de facto, não padrões — úteis se quiseres ser legível para os agentes que as adotam',
```

- [ ] **Step 7: Aggiornare il copy della UI**

In `web/app/page.jsx:177`, sostituire la frase:

```jsx
          <p className="fintro">{t("Sei categorie fanno il punteggio; le ultime tre sono controlli informativi. Tutto misurato sull'HTML servito — senza fidarci solo di ciò che il sito dichiara.")}</p>
```

Nei cinque file `web/app/translations/*.js`, sostituire la chiave vecchia con la nuova (la chiave È la frase italiana: cambiarla senza aggiornare le traduzioni fa comparire l'italiano nelle altre lingue):

```js
// en.js
  "Sei categorie fanno il punteggio; le ultime tre sono controlli informativi. Tutto misurato sull'HTML servito — senza fidarci solo di ciò che il sito dichiara.": "Six categories make up the score; the last three are informational checks. Everything is measured on the served HTML — without trusting only what the site claims.",
// de.js
  "Sei categorie fanno il punteggio; le ultime tre sono controlli informativi. Tutto misurato sull'HTML servito — senza fidarci solo di ciò che il sito dichiara.": "Sechs Kategorien bilden den Score; die letzten drei sind informative Checks. Alles wird am ausgelieferten HTML gemessen — ohne uns allein auf das zu verlassen, was die Website selbst behauptet.",
// fr.js
  "Sei categorie fanno il punteggio; le ultime tre sono controlli informativi. Tutto misurato sull'HTML servito — senza fidarci solo di ciò che il sito dichiara.": "Six catégories font le score ; les trois dernières sont des contrôles informatifs. Tout est mesuré sur le HTML servi — sans se fier uniquement à ce que le site déclare.",
// es.js
  "Sei categorie fanno il punteggio; le ultime tre sono controlli informativi. Tutto misurato sull'HTML servito — senza fidarci solo di ciò che il sito dichiara.": "Seis categorías forman la puntuación; las tres últimas son controles informativos. Todo se mide sobre el HTML servido — sin fiarnos solo de lo que el sitio declara.",
// pt.js
  "Sei categorie fanno il punteggio; le ultime tre sono controlli informativi. Tutto misurato sull'HTML servito — senza fidarci solo di ciò que il sito dichiara.": "Seis categorias fazem a pontuação; as três últimas são verificações informativas. Tudo medido no HTML servido — sem confiar apenas no que o site declara.",
```

**Attenzione:** la chiave deve corrispondere **carattere per carattere** alla stringa passata a `t()` in `page.jsx`, apostrofi tipografici compresi. Copiarla dal file JSX, non riscriverla a mano. (La riga `pt.js` qui sopra contiene di proposito un errore di battitura — «que il sito» — per rendere evidente il problema: correggerla copiando la stringa dal JSX.)

- [ ] **Step 8: Aggiungere il blocco `agentReady` nella UI**

In `web/app/page.jsx`, prima del blocco `{res.tech && (` (riga 144):

```jsx
            {res.agentReady && (
              <div className="rights">
                <div className="rt">{t('Standard d\'avanguardia per gli agenti')} <span className="info">— {t('informativo, non incide sul punteggio')}</span></div>
                <ul>
                  {res.agentReady.checks.map((c, i) => (
                    <li key={i}><span className={c.status === 'good' ? 'pin' : c.status === 'warn' ? 'pn' : 'pn'}>{c.status === 'good' ? '✓' : '○'}</span> {c.name} — {c.detail}</li>
                  ))}
                </ul>
              </div>
            )}
```

Aggiungere `"Standard d'avanguardia per gli agenti"` ai cinque file di traduzione UI:

```js
// en.js
  "Standard d'avanguardia per gli agenti": "Frontier standards for agents",
// de.js
  "Standard d'avanguardia per gli agenti": "Zukunftsstandards für Agenten",
// fr.js
  "Standard d'avanguardia per gli agenti": "Standards d'avant-garde pour les agents",
// es.js
  "Standard d'avanguardia per gli agenti": "Estándares de vanguardia para agentes",
// pt.js
  "Standard d'avanguardia per gli agenti": "Padrões de vanguarda para agentes",
```

- [ ] **Step 9: Eseguire i test**

Run: `npm test`
Expected: PASS — incluso `catalogo <lang>: nessuna chiave mancante rispetto all'italiano` per tutte e cinque le lingue.

- [ ] **Step 10: Verifica visiva della UI**

Run: `cd web && npm run dev`
Expected: su `http://localhost:3000` una scansione mostra sei barre di categoria e tre blocchi informativi; cambiando lingua non compare testo italiano nelle sezioni nuove.

- [ ] **Step 11: Commit**

```bash
git add src/messages web/app test.js
git commit -m "feat(i18n): answerability e agentReady nelle sei lingue

Le nuove chiavi tradotte in en/de/fr/es/pt (il test di parita dei cataloghi
era rosso da tre task) e il copy della UI aggiornato: sei categorie pesate,
tre blocchi informativi.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 10: Validazione sui siti reali e documentazione

I test dimostrano che il codice fa quello che gli assert dicono. Questo task verifica che le soglie siano tarate su siti veri — è il punto in cui un falso positivo si vede.

**Files:**
- Create: `docs/superpowers/plans/2026-08-04-validazione-answerability.md` (tabella dei risultati)
- Modify: `README.md` (sezione delle categorie e dei pesi)
- Test: nessun assert nuovo; si eseguono audit reali

- [ ] **Step 1: Eseguire la batteria di audit**

```bash
for u in lucarimediotti.com ahrefs.com/blog cloudflare.com/learning nytimes.com \
         canmedticino.ch grottopozzasc.ch baobab-ticino.org thundra.it; do
  echo "=== $u"
  node audit.js "$u" --json 2>/dev/null | node -e "
    let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
      const r=JSON.parse(s);
      const a=r.categories.answerability;
      console.log(r.host, r.overall, '| answerability', a.unmeasured?'unmeasured':a.score,
        '|', a.checks.map(c=>c.status).join(','));
    });"
done
```

- [ ] **Step 2: Verificare i tre falsi positivi che i test non possono cogliere**

1. **Menu contati come blocchi**: su un sito WordPress con menu ricco (grottopozzasc.ch), il check «Blocchi estraibili» non deve risultare `good` se la pagina non ha liste di contenuto. Verifica: `node audit.js grottopozzasc.ch --json | grep -A2 estraibili`.
2. **Lingua sbagliata**: su un sito tedesco o francese, il dettaglio del check «Titoli in forma di domanda» deve mostrare `lingua della pagina: de` (o `fr`), non `it`.
3. **Pagine corte massacrate**: una home vetrina deve dire `unmeasured`, e l'`overall` non deve essere più basso di quanto era prima del cambio (confrontare con `git stash` sul profilo vecchio, se serve una controprova).

- [ ] **Step 3: Scrivere la tabella dei risultati**

Creare `docs/superpowers/plans/2026-08-04-validazione-answerability.md` con: host, `overall` prima e dopo, punteggio answerability, stato dei cinque check, e una riga di commento per ogni caso in cui la soglia è sembrata sbagliata. Se una soglia va corretta, farlo qui con il test corrispondente aggiunto in `test.js`, non nei task precedenti.

- [ ] **Step 4: Aggiornare il README**

Nella sezione che elenca le categorie: sei pesate (con i pesi del profilo EVIDENCE-2026 e una riga di fonte per ciascuna) e tre informative (`agentReady`, `rights`, `tech`). Aggiungere la frase sul perché `agentFiles` è scesa a 0.05, con il rimando a `weights.json`.

- [ ] **Step 5: Eseguire i test un'ultima volta**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add docs README.md test.js
git commit -m "docs: validazione dell'answerability su otto siti reali

Tabella dei punteggi prima/dopo e verifica dei tre falsi positivi che gli
assert non possono cogliere: menu contati come blocchi, lingua della pagina,
pagine corte penalizzate.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Note di esecuzione

**Test rossi attesi fra i task.** Dopo il Task 3 il test di parità dei dizionari resta rosso fino al Task 9: è l'unico assert che può essere rosso, e solo quello. Chi preferisce ogni task completamente verde può tradurre le chiavi mano a mano nei Task 3, 5, 6 e 7 anticipando le stringhe dal Task 9.

**`test.js` non è UTF-8 pulito.** Contiene accenti in latin1 nei messaggi degli assert. Le modifiche si fanno con Edit su stringhe copiate dal file; per ispezionarlo, `node -e "console.log(require('fs').readFileSync('test.js','latin1'))"`. Mai `sed`, mai riscritture integrali del file.

**Le due funzioni di `audit.js`.** `audit()` (riga 22) e `auditHtmlSnapshot()` (riga 111) duplicano la logica di orchestrazione. Ogni task che tocca una delle due deve toccare anche l'altra: è la trappola più probabile di questo lavoro. Un `grep -c "analyzeAnswerability" audit.js` deve dare 2.

**Ordine dei task.** 1 → 2 → 3 → 4 sono in sequenza obbligata. 5, 6, 7 e 8 sono indipendenti fra loro e possono essere eseguiti in qualunque ordine dopo il 4. Il 9 richiede che 3, 5, 6 e 7 siano chiusi. Il 10 va per ultimo.

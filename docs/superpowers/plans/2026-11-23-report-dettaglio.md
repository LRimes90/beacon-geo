# /report: dettaglio analisi e switch mobile/computer. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** sotto i tre riquadri di /report, tre sezioni che mostrano cosa è stato analizzato, più tab «Dispositivi mobili | Computer» per la Performance.

**Architecture:** `auditAll` aggiunge una seconda chiamata PSI (desktop) in parallelo, restituita come `perfDesktop`; storico e delta restano su `perf` (mobile). Il client sceglie quale oggetto perf alimenta riquadro e sezione. Le sezioni sono JSX puro con le classi CSS esistenti.

**Tech Stack:** Next.js (web/), moduli ES in src/, test assert in `test.js` (`node test.js`), dizionari i18n in `web/app/translations/*.js`.

**Spec:** `docs/superpowers/specs/2026-11-23-report-dettaglio-design.md`

## Global Constraints

- Build solo sul Mac, mai su Windows; niente `node_modules` sul Drive.
- Chiave i18n = stringa italiana; ogni `t('…')` nuovo va in `en, de, fr, es, pt`.
- Report scaricabile (`suiteReport.js`) e snapshot storico invariati.
- Commenti nel codice in italiano. Nessun trattino lungo nei testi UI.
- Commit con trailer `Co-Authored-By: claude-flow <ruv@ruv.net>`. Deploy solo su richiesta di Luca.

## Review Focus

1. PSI desktop fallito o assente (chiave mancante, quota, risposta vecchia senza `perfDesktop`): il tab Computer mostra la nota «chiave PSI mancante»/non disponibile, la pagina non si rompe.
2. Categoria GEO con soli controlli `info`: niente «0/0 controlli ok», solo «n informativi».
3. `a11y.error` o `geo.error`: la sezione relativa non compare, le altre sì.
4. Larghezza telefono (360 px): le due colonne diventano una, nessuno scroll orizzontale.
5. Nuova scansione dopo aver scelto Computer: il tab resta su Computer e mostra i dati nuovi.

---

### Task 1: opportunità PSI già superate fuori da «Da sistemare»

**Files:**
- Modify: `src/perf.js:42-46` (filtro `opportunities` in `summarizePsi`)
- Test: `test.js:580-600` (blocco summarizePsi)

**Interfaces:**
- Produces: `summarizePsi(json).opportunities` = `[{title, savingsMs}]` senza audit con `score >= 0.9`; audit senza `score` restano.

- [ ] **Step 1: test che fallisce.** Nel fixture aggiungi
  `'server-response-time': { title: 'Tempo di risposta breve', score: 1, details: { type: 'opportunity', overallSavingsMs: 5 } }`
  e l'assert
  `ok(!s.opportunities.some((o) => o.title === 'Tempo di risposta breve'), 'psi: audit già superato (score 1) escluso dalle opportunità');`
  L'assert esistente `s.opportunities[0].savingsMs === 800` resta (l'audit senza `score` deve restare).
- [ ] **Step 2:** `node test.js` → FAIL sul nuovo assert.
- [ ] **Step 3:** nel `.filter` aggiungi `(a.score == null || a.score < 0.9)`.
- [ ] **Step 4:** `node test.js` → `✓ n assert passati`, nessun ✗.
- [ ] **Step 5:** commit `fix(perf): opportunità PSI già superate escluse`.

### Task 2: PSI desktop in parallelo

**Files:**
- Modify: `src/suite.js` (`auditAll`)

**Interfaces:**
- Consumes: `auditPerf(url, { strategy, key, lang })` da `src/perf.js`.
- Produces: `auditAll(...)` restituisce anche `perfDesktop` (stessa forma di `perf`, `strategy: 'desktop'`). `perf` resta la strategia richiesta (default mobile). `web/app/api/full/route.js` non cambia: inoltra l'oggetto così com'è.

- [ ] **Step 1:** in `Promise.allSettled` aggiungi `auditPerf(url, { strategy: 'desktop', key: psiKey, lang })` e nel return `perfDesktop: val(perfDesktop)`. Una riga di commento: perché in parallelo (switch istantaneo, tempo invariato) e perché lo storico resta su `perf`.
- [ ] **Step 2:** `node test.js` verde (nessun test di rete: è una chiamata in più nello stesso `allSettled`).
- [ ] **Step 3:** commit `feat(suite): PSI desktop in parallelo come perfDesktop`.

### Task 3: sezioni di dettaglio, tab e traduzioni

**Files:**
- Modify: `web/app/report/page.jsx`
- Modify: `web/app/translations/{en,de,fr,es,pt}.js`
- Test: `test.js` (nuovo blocco in coda, prima del riepilogo finale)

**Interfaces:**
- Consumes: `res.geo.categories[key] = {score, checks[{name,status,detail,fix}]}`, `res.a11y.result = {score, checks}`, `res.perf` / `res.perfDesktop` = `{ok, result:{score, metrics[{id,name,status,detail}], opportunities[{title,savingsMs}]}}`. `LABELS` per i nomi categoria GEO: copiarli da `web/app/page.jsx` (sono già chiavi tradotte).
- Produces: niente per altri task.

- [ ] **Step 1: test di copertura (verde ora, 27 chiavi).** In `test.js` importa `de, fr, es, pt` accanto a `en`; estrai le chiavi da `report/page.jsx` con
  `/\bt\(\s*'((?:[^'\\]|\\.)*)'/g` e
  `ok(mancanti.length === 0, \`report/ui: ogni t('…') tradotto in en de fr es pt (mancanti: ${…})\`)`.
- [ ] **Step 2: tab.** Stato `const [device, setDevice] = useState('mobile')`. Sopra la riga dei riquadri, due bottoni `role="tab"` con `aria-selected`, testi `t('Dispositivi mobili')` e `t('Computer')`. `const perfObj = device === 'desktop' ? res.perfDesktop : res.perf;` alimenta `perfScore`, il riquadro Performance e la sezione. Storico e delta non leggono `perfObj`.
- [ ] **Step 3: sezioni.** Dopo la `section.rights` dello storico, prima dei bottoni di download, componente locale `Detail({ title, score, info, desc, c, children, fixes })`: intestazione (titolo, info, `score/100 · t(verdict)`), descrizione, corpo, «Da sistemare» con `fixes.slice(0, 3)` solo se non vuoto. Corpi come l'anteprima B (`scratchpad/mockup.mjs`, funzione `sec`):
  - GEO: griglia 2 colonne di `.cat` con barra; sotto «n/m controlli ok» sui soli non-`info`, più «· k informativi» se k > 0. Fix = `fix` dei controlli `crit` poi `warn`.
  - Accessibilità: lista 2 colonne, pin per stato (`good ✓`, `crit ✕`, `warn !`, `info ○`), nome + dettaglio. Info = `t('controlli WCAG 2.1 · statici')`.
  - Performance: riquadri metrica (nome breve = parte prima di « · », valore `detail` colorato per stato). Fix = opportunità «titolo (~x,x s)». Se `perfObj` non ok: solo la nota `t('chiave PSI mancante')`.
  - Sezione GEO solo se `geoScore != null`, Accessibilità solo se `a11yScore != null` (stesse condizioni dei riquadri).
  - Griglie con `grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))` così a 360 px vanno su una colonna.
- [ ] **Step 4: descrizioni (copia fissata dalla spec/anteprima B).**
  - GEO: «Quanto il sito è leggibile e citabile da ChatGPT, Perplexity e Google AI: accesso dei crawler, file per gli agenti, dati strutturati, testo leggibile, risposte pronte, presenza fuori dal sito.»
  - Accessibilità: «Controlli WCAG 2.1 sull'HTML servito: lingua, titoli, testi alternativi, etichette dei form, zoom, contrasto.»
  - Performance: «Velocità misurata in laboratorio sui Core Web Vitals, gli stessi indicatori che Google usa per valutare l'esperienza.»
- [ ] **Step 5:** `node test.js` → FAIL su `report/ui` (chiavi nuove senza traduzione).
- [ ] **Step 6: traduzioni.** Bozza delle 5 lingue via FreeLLMAPI (`node ~/.claude/helpers/local-llm.mjs --profile free --out <file> …`), poi Edit in coda a ogni dizionario.
- [ ] **Step 7:** `node test.js` verde; controllo a mano che nessuna traduzione sia identica all'italiano (salvo «Lighthouse», «Computer» dove coincide).
- [ ] **Step 8:** commit `feat(report): sezioni di dettaglio e switch mobile/computer`.

### Task 4: verifica a schermo (dopo build/deploy sul Mac, su richiesta di Luca)

- [ ] Scansione con `scratchpad/report-scan.mjs` su un host di prova: le tre sezioni compaiono, il tab Computer cambia punteggio e metriche, nessuna voce «~0,0 s», nessun «2/3 ok» accanto a 100.
- [ ] Screenshot a 1000 px e a 360 px in `~/Downloads`.

# Beacon 🔦 — suite GEO · Accessibilità · Performance · AI Act

Nato come replica migliorata di [Pharos](https://pharos.verso.solutions) (GEO / AI-readiness), oggi Beacon è una **suite di quattro audit + un report unico**: misura quanto un sito è pronto a essere letto da AI, persone e motori, e **come sistemarlo**. Motore in Node puro; `axe-core` e `playwright` sono dipendenze **opzionali** (i test e il grosso dei check girano senza).

## I cinque tool

| Tool | Pagina | Cosa fa |
|---|---|---|
| **GEO checker** | `/` | AI-readiness: accesso crawler AI, file per agenti, dati strutturati, leggibilità macchina, off-site |
| **Accessibilità** | `/a11y` | Check statici WCAG 2.1 + **axe-core** (opzionale, sul DOM renderizzato) + **remediation prima/dopo senza AI** + bozza **dichiarazione di accessibilità** + **overlay diagnostico** (bookmarklet) |
| **Performance** | `/perf` | Punteggio **Lighthouse** reale + Core Web Vitals via PageSpeed Insights |
| **AI Act** | `/aiact` | Perimetro del [Reg. (UE) 2024/1689](https://eur-lex.europa.eu/eli/reg/2024/1689/oj): scansione dei segnali di trasparenza in pagina + **autovalutazione a 10 domande** → ambito, obblighi già esigibili, scadenze |
| **Report completo** | `/report` | GEO + a11y + performance in **una scansione** → PDF/HTML/Markdown brandizzato + **before-after** vs scansione precedente |

I punteggi **non si sommano**: misurano dimensioni diverse, quindi restano affiancati.

## Web UI
```bash
cd web
npm install            # next/react + beacon-geo (motore via file:..)
npm run dev            # http://localhost:3000  ·  /a11y  ·  /perf  ·  /aiact  ·  /report
```
La UI riusa il motore come pacchetto locale (`beacon-geo`, esposto in `exports`). Ogni tool ha il suo endpoint in `web/app/api/*` (runtime Node: fetch server-side, Playwright, axe-core).

## CLI (GEO)
```bash
node audit.js stripe.com            # report a schermo (no-JS)
node audit.js stripe.com --js       # + rendering JS (delta no-JS vs post-render; richiede playwright)
node audit.js stripe.com --json|--md|--html|--pdf|--llms
node crawl.js stripe.com [--max 8]  # punteggio di SITO (multi-pagina)
node batch.js [urls...]             # analisi parallela multi-sito
node compare.js tuosito.com c1.com c2.com  # confronto competitor (GEO+a11y+perf, primo = riferimento) → beacon-compare.html
node aiact.js tuosito.ch [--json] [--lang=en]  # segnali di trasparenza AI Act in pagina
node test.js                        # 261 assert sulle funzioni pure
```

## Come funziona l'accessibilità
- **Statico** (sempre): `lang`, `<title>`, alt, gerarchia heading, etichette form, zoom non bloccato.
- **Deep** (opzionale, checkbox): `axe-core` nel DOM renderizzato → contrasto reale, ARIA, ~metà dei criteri WCAG.
- **Remediation senza AI**: mappa regola→esempio *prima/dopo* (`src/remediation.js`) + `failureSummary` di axe; per le regole non mappate fallback sulla guida axe. Deterministico, gratis, zero allucinazioni.
- **Dichiarazione**: bozza Markdown **onesta** — non dichiara la conformità dal solo scan automatico (serve verifica umana).
- **Overlay**: bookmarklet **diagnostico** (evidenzia i problemi in pagina, non li "corregge" come i widget-overlay).

> ⚠️ Nessun test automatico è un audit di conformità WCAG/EAA completo: copre al massimo ~metà dei criteri. Tastiera, screen reader e senso del contenuto richiedono verifica umana.

## Come funziona il tool AI Act
Due strati, perché una scansione HTML non può sapere che ruolo giochi né a che classe di rischio appartieni:

- **Scansione** (`src/aiact.js`, facoltativa): cerca in pagina chatbot e assistenti (`art. 50 §1`), marcatori di provenienza dei contenuti sintetici (`art. 50 §2`), librerie di riconoscimento delle emozioni (`art. 5 §1 lett. f`) e segnali di offerta al mercato UE (hreflang, VAT, prezzi in euro). Funzioni pure, zero LLM: un'euristica sbagliata deve essere riproducibile e correggibile.
- **Autovalutazione** (`src/aiactAssess.js`): 10 domande su mercato, ruolo (fornitore/deployer), contenuti sintetici, deep fake, GPAI, usi ad alto rischio e pratiche vietate → verdetto su **due assi** (ambito materiale × ambito territoriale, il verdetto è il minimo dei due), elenco degli obblighi con riferimento d'articolo e data di applicabilità, scadenze `art. 113` aggiornate al pacchetto Digital Omnibus.

Le date dell'`art. 113` scadono una alla volta, quindi `assessAiAct()` prende una **data di riferimento** come parametro (default: oggi) e ne ricava `inForce`: un obbligo la cui data è passata si legge "in vigore dal …", non "dal …", e un obbligo `future` la cui scadenza è arrivata diventa esigibile da sé. Nessun `new Date()` sepolto nella logica: i test asseriscono il 2027 senza mock.

Principio: **lo scan è prova di *esistenza*, l'utente è la fonte sull'*intenzione*.** Se le due si contraddicono — "non uso IA" ma in pagina c'è un chatbot — il verdetto lo dice invece di confermare la risposta più comoda; e se l'ambito risulta fuori, gli obblighi restano in elenco marcati *condizionali*, non spariscono. La nLPD e il divieto dell'`art. 5` non si annacquano mai: valgono anche fuori dall'Unione.

> ⚠️ Non è un parere legale e non attesta la conformità: è un perimetro con la lista delle verifiche da fare. La qualificazione del ruolo e della classe di rischio va confermata da una persona competente.

## Configurazione (variabili d'ambiente)
Tutte **opzionali**: se non impostate, la funzione relativa è inerte (comportamento attuale in locale). Vanno in `web/.env.local` (gitignored) in locale, o come env dell'host in produzione.

| Variabile | A cosa serve | Se assente |
|---|---|---|
| `PAGESPEED_KEY` | chiave PageSpeed Insights per il tool Performance (gratis, 25k/die, no billing) | Performance degrada con avviso |
| `RATE_LIMIT_ON` | attiva il rate-limit per-IP sugli endpoint pesanti | nessun limite (locale) |
| `RATE_LIMIT` | richieste/minuto per IP (default 20) | 20 |
| `TURNSTILE_SECRET` | secret Cloudflare Turnstile (verifica anti-bot lato server) | verifica saltata (no-op) |
| `NEXT_PUBLIC_TURNSTILE_SITEKEY` | sitekey Turnstile (mostra il widget lato client) | widget non renderizzato |

## Architettura
```
audit.js          orchestratore CLI GEO
src/lib.js         rete (fetch retry/backoff) + parsing HTML (regex)
src/analyzers.js   analizzatori GEO — FUNZIONI PURE testabili
src/a11y.js        accessibilità: analyzeA11y (statico) + summarizeAxe + auditA11y
src/remediation.js mappa fix WCAG "prima/dopo" (no-AI) + fallback axe
src/statement.js   generatore bozza dichiarazione di accessibilità
src/perf.js        Performance via PageSpeed Insights (summarizePsi puro)
src/aiact.js       AI Act: segnali di trasparenza in pagina (analyzeAiAct puro)
src/aiactAssess.js AI Act: questionario, obblighi, verdetto a due assi (puro)
web/app/aiact/questions.mjs testi del questionario su 4 livelli: q · help · detail · examples
src/suite.js       auditAll: i 3 tool in parallelo (allSettled)
src/suiteReport.js report combinato HTML/Markdown (funzioni pure)
src/history.js     storico + diff before-after (snapshot/diff puri)
src/render.js      Playwright opzionale: renderHtml, runAxe, PDF
src/llmstxt.js     generatore llms.txt
src/report.js      export GEO Markdown/HTML
src/guard.js       rate-limit per-IP + verifica Turnstile (inerti senza env)
weights.json       pesi categorie GEO
test.js            261 assert (no framework) — girano anche in CI
```

## Test & CI
`node test.js` → 261 assert sulle funzioni pure (nessuna dipendenza richiesta). Una GitHub Action (`.github/workflows/test.yml`) li rilancia a ogni push.

## Deploy

**Live:** [beacon.lucarimediotti.com](https://beacon.lucarimediotti.com) — Namecheap cPanel (Node.js Selector + Passenger), build Next.js `standalone`, SSL via Cloudflare. `PAGESPEED_KEY` e `RATE_LIMIT_ON` impostate come env dell'app. Il **rate-limit per-IP è attivo** in produzione; Turnstile è pronto in `src/guard.js` e si attiva impostando `TURNSTILE_SECRET` + `NEXT_PUBLIC_TURNSTILE_SITEKEY` (richiede rebuild: il sitekey è inlinato a build-time).

> Nota: lo storico before-after usa un file locale (`web/.beacon-history/`), adatto a un'istanza singola come questa. Su hosting serverless multi-istanza servirebbe un KV/SQLite condiviso.

## Roadmap
- **Fatto:** suite a 5 tool, CLI GEO + CLI AI Act, remediation no-AI, dichiarazione, overlay, storico before-after, report PDF/HTML/MD, CI, **deploy pubblico + rate-limit attivo**.
- **Prossimi:** attivare Turnstile se emerge abuso reale; valutare storico su KV se si passa a multi-istanza.

MIT · un progetto di Luca Rimediotti.

# Beacon 🔦 — suite GEO · Accessibilità · Performance

Nato come replica migliorata di [Pharos](https://pharos.verso.solutions) (GEO / AI-readiness), oggi Beacon è una **suite di tre audit + un report unico**: misura quanto un sito è pronto a essere letto da AI, persone e motori, e **come sistemarlo**. Motore in Node puro; `axe-core` e `playwright` sono dipendenze **opzionali** (i test e il grosso dei check girano senza).

## I quattro tool

| Tool | Pagina | Cosa fa |
|---|---|---|
| **GEO checker** | `/` | AI-readiness: accesso crawler AI, file per agenti, dati strutturati, leggibilità macchina, off-site |
| **Accessibilità** | `/a11y` | Check statici WCAG 2.1 + **axe-core** (opzionale, sul DOM renderizzato) + **remediation prima/dopo senza AI** + bozza **dichiarazione di accessibilità** + **overlay diagnostico** (bookmarklet) |
| **Performance** | `/perf` | Punteggio **Lighthouse** reale + Core Web Vitals via PageSpeed Insights |
| **Report completo** | `/report` | I tre tool in **una scansione** → PDF/HTML/Markdown brandizzato + **before-after** vs scansione precedente |

I tre punteggi **non si sommano**: misurano dimensioni diverse, quindi restano affiancati.

## Web UI
```bash
cd web
npm install            # next/react + beacon-geo (motore via file:..)
npm run dev            # http://localhost:3000  ·  /a11y  ·  /perf  ·  /report
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
node test.js                        # 108 assert sulle funzioni pure
```

## Come funziona l'accessibilità
- **Statico** (sempre): `lang`, `<title>`, alt, gerarchia heading, etichette form, zoom non bloccato.
- **Deep** (opzionale, checkbox): `axe-core` nel DOM renderizzato → contrasto reale, ARIA, ~metà dei criteri WCAG.
- **Remediation senza AI**: mappa regola→esempio *prima/dopo* (`src/remediation.js`) + `failureSummary` di axe; per le regole non mappate fallback sulla guida axe. Deterministico, gratis, zero allucinazioni.
- **Dichiarazione**: bozza Markdown **onesta** — non dichiara la conformità dal solo scan automatico (serve verifica umana).
- **Overlay**: bookmarklet **diagnostico** (evidenzia i problemi in pagina, non li "corregge" come i widget-overlay).

> ⚠️ Nessun test automatico è un audit di conformità WCAG/EAA completo: copre al massimo ~metà dei criteri. Tastiera, screen reader e senso del contenuto richiedono verifica umana.

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
src/suite.js       auditAll: i 3 tool in parallelo (allSettled)
src/suiteReport.js report combinato HTML/Markdown (funzioni pure)
src/history.js     storico + diff before-after (snapshot/diff puri)
src/render.js      Playwright opzionale: renderHtml, runAxe, PDF
src/llmstxt.js     generatore llms.txt
src/report.js      export GEO Markdown/HTML
src/guard.js       rate-limit per-IP + verifica Turnstile (inerti senza env)
weights.json       pesi categorie GEO
test.js            78 assert (no framework) — girano anche in CI
```

## Test & CI
`node test.js` → 78 assert sulle funzioni pure (nessuna dipendenza richiesta). Una GitHub Action (`.github/workflows/test.yml`) li rilancia a ogni push.

## Deploy

**Live:** [beacon.lucarimediotti.com](https://beacon.lucarimediotti.com) — Namecheap cPanel (Node.js Selector + Passenger), build Next.js `standalone`, SSL via Cloudflare. `PAGESPEED_KEY` e `RATE_LIMIT_ON` impostate come env dell'app. Il **rate-limit per-IP è attivo** in produzione; Turnstile è pronto in `src/guard.js` e si attiva impostando `TURNSTILE_SECRET` + `NEXT_PUBLIC_TURNSTILE_SITEKEY` (richiede rebuild: il sitekey è inlinato a build-time).

> Nota: lo storico before-after usa un file locale (`web/.beacon-history/`), adatto a un'istanza singola come questa. Su hosting serverless multi-istanza servirebbe un KV/SQLite condiviso.

## Roadmap
- **Fatto:** suite a 4 tool, CLI GEO, remediation no-AI, dichiarazione, overlay, storico before-after, report PDF/HTML/MD, CI, **deploy pubblico + rate-limit attivo**.
- **Prossimi:** attivare Turnstile se emerge abuso reale; valutare storico su KV se si passa a multi-istanza.

MIT · un progetto di Luca Rimediotti.

# Beacon 🔦 — GEO / AI-readiness checker

Replica migliorata di [Pharos](https://pharos.verso.solutions). Analizza quanto un sito è pronto a essere letto, capito e citato da crawler e agenti AI, e **come sistemarlo**. Motore MVP in Node puro, **zero dipendenze**.

## Uso

```bash
node audit.js stripe.com            # report leggibile a schermo (no-JS)
node audit.js stripe.com --js       # + rendering JS: delta no-JS vs post-render (richiede: npm i playwright)
node audit.js stripe.com --json     # report JSON (per pipeline)
node audit.js stripe.com --llms     # genera il llms.txt del sito
node audit.js stripe.com --md       # report Markdown cliente-ready
node audit.js stripe.com --html     # report HTML brandizzato (stampabile in PDF dal browser)
node audit.js stripe.com --pdf      # PDF diretto (richiede: npm i playwright)
node crawl.js stripe.com            # punteggio di SITO (multi-pagina, aggregato)
node crawl.js stripe.com --max 8    # analizza fino a 8 pagine
node batch.js                       # analizza la lista di default (52 siti)
node batch.js a.com b.io c.dev      # analizza gli URL passati
node test.js                        # assert sulle funzioni pure
```

### Crawl multi-pagina (fase 2)
`crawl.js` scopre le pagine chiave (prima da `sitemap.xml`, fallback sui link interni) e produce un **punteggio di sito**: le categorie *site-level* (accesso, file agenti, off-site) sono calcolate una volta; *SEO* e *leggibilità* sono la **media** sulle pagine analizzate. Supporta `--js` e `--max N`.

### Rendering JS (fase 2)
`--js` renderizza la pagina con Chromium headless e confronta il contenuto no-JS con quello post-render: è il check che smaschera le SPA (contenuto iniettato via JavaScript che i bot non eseguono non vedono). Playwright è una dipendenza **opzionale**: senza, l'analisi procede in modalità no-JS.
```bash
npm i playwright && npx playwright install chromium
node audit.js notion.so --js
```

> **Nota rete:** `batch.js` fa ~12 richieste per sito. Eseguilo da una macchina con rete non limitata (il tuo Mac, o un serverless): ambienti sandbox saturano le connessioni outbound oltre ~25-30 siti.

## Cosa misura (5 + 1 categorie)

| Categoria | Peso | Check |
|---|---|---|
| Accesso AI | 0.25 | robots.txt per 19 UA AI + fetch live impersonato (5 UA) |
| File per agenti | 0.15 | robots, sitemap, **llms.txt** + skill.md, .well-known/mcp.json, agent-skills |
| Dati strutturati/SEO | 0.20 | title, meta, JSON-LD, canonical, hreflang, OG, Twitter |
| Leggibilità macchina | 0.25 | parole in HTML, ratio semantico, heading, alt |
| Visibilità off-site | 0.15 | CCBot + presenza Common Crawl (best-effort) |
| *Delta JS* 🆕 | — | (fase 2) confronto no-JS vs post-render headless |

## Validazione vs Pharos
Dove il fetch riesce, il motore combacia con Pharos entro pochi punti:
`stripe 85/83 · google 65/66 · wikipedia 68/67 · netflix 66/65 · amazon 29/32 · cern 63/61`.

## Web UI (fase 3)
Interfaccia Next.js in `web/` che riusa il motore come pacchetto locale (`beacon-geo` via `file:..`, esposto in `exports`). La API route `app/api/audit/route.js` chiama `audit()` server-side (runtime Node, così funzionano fetch e Playwright); la pagina mostra punteggio, categorie e azioni.
```bash
cd web
npm install            # risolve next/react + beacon-geo (file:..)
npm run dev            # http://localhost:3000
```
> Scaffold consegnato, non ancora eseguito in questo ambiente: fai `npm install` sul tuo Mac. Per il deploy pubblico: Vercel/Netlify + Turnstile & rate-limit (vedi PRD).

## Architettura
```
audit.js         orchestratore CLI (fa il fetching, chiama gli analizzatori)
src/lib.js       rete (fetch con retry/backoff) + parsing HTML (regex)
src/analyzers.js i 5+1 analizzatori — FUNZIONI PURE, testabili senza rete
src/llmstxt.js   generatore llms.txt
weights.json     pesi delle categorie (configurabili)
batch.js         analisi parallela multi-sito (retry + marcatura affidabilità)
test.js          check runnabile (assert, niente framework)
```

## Tuning dei pesi — TODO(human)
I pesi in `weights.json` sono un default ragionevole. **Vanno tarati** confrontando l'output di Beacon con i punteggi reali di Pharos (dataset in raccolta). È una scelta di prodotto: decidi tu quanto pesa "essere pronti per gli agenti" (llms.txt/mcp) rispetto alla SEO classica.

## Roadmap
- **Fase 1 (fatta):** motore 5+1, CLI, generatore llms.txt, batch, test.
- **Fase 2:** rendering JS on-demand (Playwright) → sblocca le SPA; crawl multi-pagina; export PDF/MD brandizzato.
- **Fase 3 (se pubblico):** UI Next.js, Turnstile + rate-limit, cache/shareUrl, i18n it/en.

MIT · un progetto di Luca Rimediotti.

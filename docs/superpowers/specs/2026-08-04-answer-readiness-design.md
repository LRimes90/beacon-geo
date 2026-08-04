# Answer-readiness e profilo pesi EVIDENCE-2026

Data: 2026-08-04
Stato: approvato, pronto per il piano di implementazione
Autore: Luca Rimediotti / Snyffo

## Problema

Beacon misura se una macchina *vede* il contenuto (`analyzeReadability`: parole senza JS,
ratio semantico HTML5, H1 unico, alt delle immagini, delta JS). Non misura se quel
contenuto *risponde a una domanda* in una forma che un motore generativo può estrarre e
citare. È il pilastro editoriale del GEO, dichiarato mancante dal 2026-07-09, e l'unica
cosa che i tool concorrenti coprono e Beacon no.

Parallelamente i pesi attuali (profilo BEACON: `access` 0.23, `agentFiles` 0.20,
`structured` 0.24, `readability` 0.23, `offsite` 0.10) derivano da una taratura fatta per
replicare Pharos, non dall'evidenza empirica pubblicata fra il 2025 e il 2026. Su tre
categorie su cinque l'evidenza contraddice il peso assegnato.

## Decisioni

### 1. Profilo pesi EVIDENCE-2026

`weights.mjs` e `weights.json` passano a sei categorie pesate. Ogni peso porta accanto la
fonte misurata. I profili storici BEACON e PHAROS restano documentati nel commento.

| Categoria | Prima | Dopo | Base empirica |
|---|---|---|---|
| `answerability` (nuova) | — | 0.25 | tabelle/liste citate 2,5x; sezioni autonome +65%; heading-query 41% vs 29%; GEO paper KDD 2024: quotation +40%, fluency +15-30% |
| `readability` | 0.23 | 0.22 | Vercel + MERJ: oltre 500M fetch GPTBot, zero JavaScript eseguito; ClaudeBot scarica JS nel 23,84% delle richieste e non lo esegue mai |
| `access` | 0.23 | 0.18 | BuzzStream, 4M citazioni su 3.600 prompt: il 95% delle pagine citate bloccava GPTBot; ~70% delle citazioni ChatGPT da siti che bloccavano OAI-SearchBot |
| `structured` | 0.24 | 0.15 | Ahrefs, 1.885 pagine con JSON-LD aggiunto vs 4.000 di controllo (ago 2025 – mar 2026): nessun effetto su ChatGPT e AI Mode, −4,6% citazioni AI Overviews (significativo) |
| `offsite` | 0.10 | 0.15 | Ahrefs, 75.000 brand: brand web mentions r=0.664, anchor 0.527, search volume 0.392 vs backlink 0.218; menzioni YouTube 0.737 |
| `agentFiles` | 0.20 | 0.05 | Ahrefs, 137.210 domini con traffico reale: 97% dei file `llms.txt` mai letto; SE Ranking su ~300.000 domini: zero correlazione con le citazioni; Mueller: nessun sistema Google Search lo legge |

Somma 1.00.

**`offsite` resta a 0.15 e non sale a 0.30 pur avendo la correlazione più alta**: la
correlazione riguarda le *menzioni di brand*, mentre Beacon misura "CCBot ammesso +
presenza in Common Crawl", che è un proxy debole. Il peso segue ciò che il codice misura
davvero, non ciò che l'evidenza vorrebbe misurare. Il gap va dichiarato nel report.

**Trasparenza obbligatoria**: l'output di `audit()` e `auditFromHtml()` include
`profile: 'EVIDENCE-2026'`, mostrato in fondo al report. `history.js` registra il profilo
nello snapshot e `diff()` segnala «profilo diverso, delta non confrontabile» invece di
mostrare una variazione che non è un cambiamento del sito.

### 2. `answerability` — categoria pesata, cinque check

Firma coerente con gli altri analizzatori: funzione pura,
`analyzeAnswerability({ served, rendered }, lang)` → `{ score, checks[], unmeasured? }`.

| # | Check | Peso | Euristica | Soglia |
|---|---|---|---|---|
| 1 | Risposta diretta dopo l'heading | 25 | per ogni H2/H3, prima frase del primo blocco di testo successivo; si usa la **mediana** delle lunghezze | ≤30 parole `good`, ≤50 `warn`, oltre `crit` |
| 2 | Blocchi estraibili | 20 | `<ul>`/`<ol>` con ≥3 `<li>` e `<table>` con `<th>`, normalizzati sulla lunghezza del testo | ≥1 ogni 500 parole `good`, ≥1 ogni 1000 `warn` |
| 3 | Paragrafi digeribili | 20 | distribuzione delle parole per `<p>` (ignorando i `<p>` sotto le 10 parole) | <10% oltre 120 parole `good`, <25% `warn` |
| 4 | Heading in forma di domanda | 15 | quota di H2/H3 che terminano con `?` o iniziano con una parola interrogativa | ≥25% `good`, ≥10% `warn` |
| 5 | Evidenza citabile | 20 | numeri con unità/percentuale/anno, `<blockquote>`, `<cite>`, link esterni dentro `<p>` | ≥3 elementi `good`, ≥1 `warn` |

Mediana e non media nel check 1: una singola sezione con un cappello lungo non deve
affossare una pagina per il resto pulita.

**Difese contro i falsi positivi** (parte del contratto, non rifiniture):

- Le liste di navigazione non sono contenuto estraibile: escluse quelle dentro `<nav>`,
  `<header>`, `<footer>` e quelle in cui oltre il 70% dei `<li>` è composto quasi solo da
  un link. Senza questo filtro ogni sito WordPress guadagna 20 punti per il proprio menu.
- Le parole interrogative si leggono nella lingua **della pagina**: il check 4 usa
  `<html lang>` con fallback euristico sul testo, non il parametro `lang` del report. Un
  sito italiano analizzato con report in inglese va valutato con «come, cosa, perché,
  quando, quanto, quale, chi, dove». Il dizionario `QUESTION_WORDS` per le sei lingue
  (it/en/de/fr/es/pt) sta in `analyzers.js`: sono dati, non messaggi UI, quindi non vanno
  in `src/messages/`.
- Le pagine che non sono contenuto non vengono penalizzate: sotto le 300 parole di testo
  la categoria ritorna `unmeasured: true`. Il loop di `audit.js:86` salta già le categorie
  `unmeasured` e ridistribuisce il peso — nessun codice nuovo. Semantica coerente con
  l'uso originale (`analyzeOffsite` quando Common Crawl non è interrogabile): *non ho i
  presupposti per giudicare*.

**Ceiling dichiarato** (commento `ponytail:` nel codice): l'analisi resta su regex e non su
un parser DOM, per coerenza con `semanticRatio`, `headings` e `imgAlt` e per il vincolo
zero-dipendenze del progetto. HTML malformato o `<p>` non chiusi degradano il check 3; la
via d'uscita è un tokenizer minimale, non `cheerio`.

### 3. `agentReady` — settima categoria informativa

Accanto a `rights`, `tech` e `a11y`. **Non** in `CATEGORY_LABELS`, quindi strutturalmente
incapace di entrare nell'overall. Informativa per scelta: non esiste evidenza che questi
segnali correlino con le citazioni, e pesarli perché sono moderni ripeterebbe esattamente
l'errore di `llms.txt`.

- **AIPREF `Content-Usage`** (IETF AI Preferences WG): header HTTP e regola omonima in
  `robots.txt`; se presente si legge il vocabolario `train-ai` / `search` con valori
  `y`/`n`. `draft-ietf-aipref-vocab` è su Proposed Standard track (rev. 06);
  `draft-ietf-aipref-attach` ha milestone agosto 2026 verso l'IESG. È il successore
  standard di TDMRep, RSL e Content-Signal, che `analyzeRights` già rileva e che sono
  progettati per annidarsi in AIPREF.
- **Web Bot Auth** (IETF, RFC 9421 HTTP Message Signatures; Cloudflare, Amazon, Akamai,
  OpenAI; in produzione all'edge Cloudflare da marzo 2026): Beacon **non può** verificare
  la configurazione del WAF dall'esterno, perché è il bot a firmare, non il sito. Inviare
  un `Signature-Agent` senza firma valida sarebbe spoofing, non una misura. Il check è
  quindi diagnostico e riusa i dati di `liveFetch`: se le risposte differiscono fra
  user-agent browser e user-agent AI, il sito filtra per user-agent, e il check spiega che
  il modello corrente è la verifica della firma. Zero fetch aggiuntivi. **Il limite va
  scritto nel check**, non omesso.
- **WebMCP** (W3C, Draft Community Group Report 2026-02-10; Chrome 146 lo spedisce, origin
  trial in Chrome 149): sull'HTML renderizzato si cercano `document.modelContext`,
  `navigator.modelContext` (deprecato in Chrome 150) e `registerTool`. Rilevazione
  testuale, non esecuzione dell'API — ceiling dichiarato.

`skill.md`, `.well-known/mcp.json` e `agent-skills` escono dagli "standard emergenti" di
`agentFiles` e si trasferiscono qui, etichettati come convenzioni di fatto, non standard.

### 4. `agentFiles` ricomposta

Resta `robots.txt`, `sitemap.xml` e `llms.txt`. I primi due sono segnali di scopribilità
reale (i retrieval bot usano la sitemap per scoprire URL; è la base di IndexNow per
Bing/Copilot). `llms.txt` diventa un check **informativo** con una nota che ne dichiara
l'uso reale — indice di documentazione per assistenti di codice come Cursor e Cline — e
**senza** un `fix` che promette citazioni.

Precedente di mercato: Otterly ha rimosso il checker `llms.txt` dal proprio GEO audit dopo
aver analizzato milioni di citazioni su ChatGPT, Perplexity e AI Overviews, non vedendo
impatti.

### 5. `access` — separare training da retrieval

`analyzeAccess` oggi conta tutti i bot in un unico `{allowed}/{total} crawler AI ammessi`.
I due gruppi hanno conseguenze opposte e vanno separati nel dettaglio del check:

| Famiglia | Bot | Conseguenza del blocco |
|---|---|---|
| Training | GPTBot, ClaudeBot, Google-Extended | nessuna sulle citazioni odierne: gli archivi sono retroattivi |
| Retrieval live | OAI-SearchBot, ChatGPT-User, Claude-User, PerplexityBot | non essere citabile in tempo reale |

Dentro la categoria, `liveFetch` pesa più di `robots`. Nota da riportare nel report:
`Google-Extended` esclude solo il training di Gemini e Vertex AI, non tocca ranking né AI
Overviews.

## Posizionamento

I tool concorrenti (Semrush 99 $/mese, Ahrefs Brand Radar 199 $, Peec 95 $, Profound 99 $,
Scrunch 250 $) fanno tracking di prompt e share of voice: eseguono query sui motori e
contano chi viene menzionato. È monitoraggio di brand, non audit tecnico. L'unico che fa
audit tecnico è Otterly a 29 $ (crawlability + content extractability, 25+ fattori).

Il differenziatore di Beacon non è misurare cose nuove: è **dichiarare cosa pesa, quanto e
su quale studio**. Nessuno degli strumenti sopra pubblica i propri pesi. Va detto anche il
rovescio, che Ahrefs scrive nel proprio studio: correlazione non è causalità. Un motore che
dichiara i pesi deve dichiarare anche questo.

## Ambito dell'implementazione

- `src/analyzers.js`: `analyzeAnswerability`, `analyzeAgentReady`, `QUESTION_WORDS`,
  `analyzeAgentFiles` ricomposta, dettaglio di `analyzeAccess` separato per famiglia,
  `answerability` in `CATEGORY_LABELS`.
- `weights.mjs` e `weights.json`: profilo EVIDENCE-2026 con le fonti.
- `audit.js`: `answerability` in `results`, `agentReady` nel return, campo `profile`.
- `src/history.js`: profilo nello snapshot, guardia nel `diff()`.
- `src/messages/*.js` (sei lingue): nuove chiavi per i check e i fix.
- `src/report.js`, `src/suiteReport.js`, `src/compareReport.js`, `web/app/report`: resa
  della nuova categoria e del profilo.
- `test.js`: i falsi positivi prima dei casi felici — menu `<ul>` in `<nav>` che non conta
  come blocco estraibile; pagina da 150 parole che torna `unmeasured`; un heading
  interrogativo per ciascuna delle sei lingue; `<p>` non chiuso che non fa esplodere il
  conteggio; snapshot con profili diversi che non produce un delta.
- Validazione sui siti reali già usati per la taratura prima di considerare chiuso il
  lavoro.

## Fuori ambito

Gate email sul PDF del report, monitor schedulato con alert, generatori come rimedi inline,
audit di sito nel web: sono i punti 1, 3, 4 e 5 del piano complessivo, ognuno con il
proprio spec.

## Fonti

- Ahrefs — [AI Overview brand visibility factors, 75K brand](https://ahrefs.com/blog/ai-overview-brand-correlation/)
- Ahrefs — [137K siti: il 97% dei file llms.txt non viene mai letto](https://ahrefs.com/blog/llmstxt-study/)
- Aggarwal et al. — [GEO: Generative Engine Optimization, ACM SIGKDD 2024](https://arxiv.org/abs/2311.09735)
- Search Engine Roundtable — [lo studio sullo schema non migliora le citazioni AI](https://www.seroundtable.com/study-schema-citations-study-41311.html)
- Lantern — [gli AI crawler non renderizzano JavaScript (Vercel/MERJ)](https://www.asklantern.com/blogs/ai-crawlers-do-not-render-javascript)
- SearchOptimo — [GPTBot, ClaudeBot e Perplexity nel 2026](https://searchoptimo.com/blog/do-ai-crawlers-render-javascript)
- BuzzStream — [i publisher che bloccano i bot AI vengono citati meno?](https://www.buzzstream.com/blog/news-block-ai-bots-citations/)
- AirOps — [heading in forma di domanda e citazioni AI](https://www.airops.com/blog/question-based-headings-ai-citations)
- IETF — [AI Preferences working group](https://www.ietf.org/blog/aipref-wg/) · [draft-ietf-aipref-attach](https://ietf-wg-aipref.github.io/drafts/draft-ietf-aipref-attach.html)
- Cloudflare — [Web Bot Auth](https://blog.cloudflare.com/web-bot-auth/) · [signed agents in produzione](https://blog.cloudflare.com/signed-agents/)
- Patrick Brosset — [WebMCP: aggiornamenti e prossimi passi](https://patrickbrosset.com/articles/2026-02-23-webmcp-updates-clarifications-and-next-steps/)
- Otterly — [perché abbiamo ricostruito il GEO audit da zero](https://otterly.ai/blog/geo-audit-crawlability-content-checker/)
- Insites — [gli 8 migliori tool di AI visibility e GEO per agenzie, 2026](https://insites.com/blog/the-8-best-ai-visibility-and-geo-auditing-tools-for-digital-marketing-agencies/)
- DataImpulse — [robots.txt e crawler AI nel 2026: training vs retrieval](https://dataimpulse.com/blog/robots-txt-ai-crawlers/)

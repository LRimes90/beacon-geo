# Validazione dell'answerability su siti reali

Data esecuzione: 2026-11-22. Solo richieste GET pubbliche. «Prima» = codice di `main` (profilo BEACON, cinque categorie), «dopo» = ramo `feat/answer-readiness` (profilo EVIDENCE-2026, sei categorie), stesso giorno e stessa rete.

Controllo del 2026-11-22: la colonna «prima» è quello che la produzione mostra oggi. `beacon.lucarimediotti.com/api/audit` dà gli stessi overall di `main` su tutti e 8 i siti. Solo cloudflare.com/learning, rieseguito qualche ora dopo, dà 46 sia in produzione sia su `main` (48 in tabella): varia la pagina, non il codice. La tabella non usa scansioni passate.

Check answerability, nell'ordine: risposta diretta, blocchi estraibili, paragrafi digeribili, titoli in forma di domanda, evidenza citabile.

| Host | Overall prima | Overall dopo | Answerability | Check (g=good, w=warn, c=crit) |
|---|---|---|---|---|
| lucarimediotti.com | 93 | 96 | 85 | g g g c g |
| ahrefs.com (/blog) | 73 | 82 | 84 | g w g w g |
| cloudflare.com (/learning) | 48 | 38 | non misurata | info (0 parole, pagina non ottenuta) |
| nytimes.com | 20 | 18 | non misurata | info (8 parole, pagina non ottenuta) |
| canmedticino.ch | 98 | 90 | 65 | g g g c c |
| grottopozzasc.ch | 77 | 74 | 45 | g c g c c |
| baobab-ticino.org | 64 | 81 | 93 | g g g w g |
| thundra.it | 83 | 79 | 84 | g w g w g |

Tutti e otto i siti hanno risposto. Cloudflare e NYT servono ai bot una pagina vuota o di sfida (`fetchedOk: false`): l'answerability esce dal punteggio come previsto.

## Esito dei tre falsi positivi

1. Menu contati come blocchi: non si verifica. grottopozzasc.ch (menu ricco) dà «0 blocchi su 441 parole (0 liste, 0 tabelle)», check `crit`, non `good`. I menu non entrano nel conteggio.
2. Lingua sbagliata: non si verifica. ch.ch/fr dà «lingua della pagina: fr»; de.wikipedia.org/wiki/Schweiz dà `de` (0/98 titoli a domanda); fr.wikipedia.org/wiki/Suisse dà `fr`. Mai `it` su pagine non italiane. ch.ch/de è sotto le 300 parole e quindi non misurata.
3. Pagine corte massacrate: non si verifica. ch.ch/de (269 parole) esce `unmeasured` e l'overall sale da 77 (main) a 85. Le pagine sotto le 300 parole non vengono penalizzate.

## Commenti sulle soglie

- Nessuna soglia da correggere: nessun falso positivo emerso, quindi nessun test aggiunto in questo task.
- Cali di overall (cloudflare -10, nytimes -2, canmedticino -8, grottopozzasc -3, thundra -4) non vengono dall'answerability sulle pagine non misurate, ma dalla ripesatura: `agentFiles` vale 0.05 invece di 0.20 (i siti con robots e sitemap perdono il vantaggio dato da llms.txt, ma non guadagnano nulla da esso) e `access` pesa il fetch live (45 su 100) più del robots.txt. Per cloudflare l'access passa da 68 a 55 perché i crawler di retrieval risultano bloccati.
- canmedticino.ch: answerability 65 con check «blocchi estraibili» e «evidenza citabile» a `crit` (3 blocchi su 956 parole, 0 elementi di evidenza). Plausibile per un sito associativo di testo corrente, non un difetto della soglia.
- grottopozzasc.ch (441 parole, 4 sezioni) è una home vetrina appena sopra le 300 parole: viene misurata e ottiene 45. La soglia delle 300 parole la lascia dentro il punteggio; da tenere d'occhio se compaiono altre home brevi con voto basso.
- Gli aumenti (baobab-ticino.org +17, ahrefs.com +9) vengono dall'answerability alta (93 e 84) e dalla scomparsa del malus llms.txt.

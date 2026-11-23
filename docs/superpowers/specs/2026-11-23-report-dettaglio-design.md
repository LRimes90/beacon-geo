# /report: dettaglio delle analisi e switch mobile/computer

Data: 2026-11-23 · Stato: approvato da Luca («vai», dopo l'anteprima B)

## Perché

Su /report i tre riquadri (GEO/AI, Accessibilità, Performance) mostrano solo il punteggio.
Chi legge non sa cosa è stato analizzato. Riferimento: PageSpeed Insights, che mostra
tutte le analisi fatte e ha lo switch dispositivi mobili / computer.

## Obiettivi

- Sotto il riquadro «Rispetto alla scansione precedente», tre sezioni a tutta larghezza
  (variante B delle anteprime), una per strumento:
  intestazione (nome, info, punteggio/100 · giudizio), descrizione di una riga,
  controlli su due colonne, «Da sistemare» con al massimo 3 voci.
- Tab «Dispositivi mobili | Computer» sopra i tre riquadri: cambiano all'istante
  il riquadro e la sezione Performance. GEO e accessibilità non cambiano (stesso HTML).
- Correzioni emerse dalle anteprime:
  - le opportunità PSI già superate non compaiono più («~0,0 s» fra le cose da sistemare);
  - i controlli informativi si contano a parte: niente «2/3 ok» accanto a un 100.
- Stringhe nuove tradotte nelle 6 lingue del sito.

## Non obiettivi

- Il report scaricabile (PDF/HTML/MD) resta com'è.
- axe in produzione (resta «solo statico»).
- Storico e delta: restano su mobile, perché tutti gli snapshot passati sono mobile.

## Approcci valutati

Layout:
- A, schede compatte: poco spazio, ma i dettagli restano nascosti. Scartata.
- **B, sezioni a tutta larghezza**: scelta da Luca («questa mi piace»).
- C, stile PSI (lista lunga di audit): fedele al riferimento ma pesante per un utente non tecnico.

Switch:
- Toggle prima della scansione (`strategy` già accettato dall'API): una sola chiamata PSI,
  ma per vedere l'altro dispositivo serve rifare tutta la scansione.
- **PSI mobile + computer in parallelo** nella stessa scansione: due chiamate PSI
  contemporanee, tempo totale invariato, switch istantaneo. Scelto.

## Decisioni

- `auditAll` lancia anche `auditPerf(..., { strategy: 'desktop' })` in parallelo e lo
  restituisce come `perfDesktop`. `perf` resta mobile: snapshot e delta non cambiano.
- Filtro opportunità in `summarizePsi`: escluse quelle con `score >= 0.9`;
  quelle senza `score` restano.
- Le sezioni usano le classi CSS esistenti (`.rights`, `.cat`, `.bar`, `.pin/.pn/.pc`, `.fixes`).

## Scelte mie (correggibili)

- Contatore GEO: «n/m controlli ok» sui soli controlli valutati; gli informativi a parte.
- Metriche Performance in riquadri (nome breve + valore colorato per stato), come nell'anteprima B.
- Se `perfDesktop` manca o fallisce, il tab Computer mostra la nota di non disponibilità.
- Test: un assert sul filtro opportunità, uno su `perfDesktop` se fattibile senza rete,
  uno di copertura traduzioni delle stringhe di `report/page.jsx`.

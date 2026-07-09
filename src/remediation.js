// src/remediation.js — mappa di remediation WCAG SENZA AI.
// Regola (id axe) → perché conta + esempio "prima → dopo". Deterministico, zero costi,
// zero allucinazioni, testabile. Per le regole non mappate si ricade sul failureSummary
// + helpUrl di axe (sempre presenti): nessun buco di copertura.

export const REMEDIATION = {
  'image-alt': {
    why: "Gli screen reader annunciano le immagini tramite l'attributo alt; senza, l'utente non sa cosa mostrano.",
    before: '<img src="foto.jpg">',
    after: '<img src="foto.jpg" alt="[descrivi cosa mostra l\'immagine]">',
  },
  'label': {
    why: 'Un campo senza etichetta associata non viene annunciato: lo screen reader legge solo "casella di testo".',
    before: '<input type="email" id="email">',
    after: '<label for="email">Email</label>\n<input type="email" id="email">',
  },
  'html-has-lang': {
    why: 'Senza lang lo screen reader non sa in che lingua leggere: pronuncia errata.',
    before: '<html>',
    after: '<html lang="it">',
  },
  'html-lang-valid': {
    why: 'Il codice lingua deve essere valido (es. "it", "de", "fr"), altrimenti viene ignorato.',
    before: '<html lang="italiano">',
    after: '<html lang="it">',
  },
  'color-contrast': {
    why: 'Testo con contrasto sotto 4.5:1 (3:1 se grande) è illeggibile per ipovedenti. axe indica sotto i colori esatti e il rapporto attuale.',
    before: 'color:#999; background:#fff;  /* ~2.8:1 */',
    after: 'color:#595959; background:#fff; /* 7:1 ✓ */',
  },
  'link-name': {
    why: 'Un link senza testo (es. solo icona) non è annunciabile: lo screen reader legge "link" e basta.',
    before: '<a href="/carrello"><svg>…</svg></a>',
    after: '<a href="/carrello" aria-label="Carrello"><svg aria-hidden="true">…</svg></a>',
  },
  'button-name': {
    why: 'Un bottone senza nome accessibile non è utilizzabile da chi non vede lo schermo.',
    before: '<button><svg>…</svg></button>',
    after: '<button aria-label="Chiudi"><svg aria-hidden="true">…</svg></button>',
  },
  'select-name': {
    why: 'Un menu a tendina senza etichetta non viene annunciato: lo screen reader non sa cosa si sta scegliendo.',
    before: '<select id="paese">…</select>',
    after: '<label for="paese">Paese</label>\n<select id="paese">…</select>',
  },
  'document-title': {
    why: 'Il <title> è la prima cosa annunciata: identifica la pagina e distingue le schede del browser.',
    before: '<title></title>',
    after: '<title>Contatti — Nome Sito</title>',
  },
  'heading-order': {
    why: 'I titoli danno la mappa della pagina; saltare livelli (H2→H4) disorienta la navigazione per heading.',
    before: '<h2>Sezione</h2>\n<h4>Sottotitolo</h4>',
    after: '<h2>Sezione</h2>\n<h3>Sottotitolo</h3>',
  },
  'list': {
    why: 'Gli elenchi vanno marcati come tali: gli screen reader annunciano "elenco di N voci".',
    before: '<div>• voce</div>\n<div>• voce</div>',
    after: '<ul>\n  <li>voce</li>\n  <li>voce</li>\n</ul>',
  },
  'region': {
    why: 'Il contenuto principale va dentro un landmark (main/nav/…) per permettere il salto rapido.',
    before: '<div>…contenuto principale…</div>',
    after: '<main>…contenuto principale…</main>',
  },
  'meta-viewport': {
    why: 'Bloccare lo zoom (user-scalable=no) impedisce a chi ha problemi di vista di ingrandire il testo.',
    before: '<meta name="viewport" content="width=device-width, user-scalable=no">',
    after: '<meta name="viewport" content="width=device-width, initial-scale=1">',
  },
  'frame-title': {
    why: 'Ogni <iframe> ha bisogno di un title che ne descriva il contenuto.',
    before: '<iframe src="…"></iframe>',
    after: '<iframe src="…" title="Mappa della sede"></iframe>',
  },
  'duplicate-id': {
    why: 'Gli id duplicati rompono le associazioni label/aria e la navigazione assistiva.',
    before: '<input id="nome"> … <input id="nome">',
    after: '<input id="nome"> … <input id="cognome">',
  },
};

// Ritorna { why, before, after } per un finding axe; se la regola non è mappata,
// ricade su help + sampleHtml di axe (after=null → la guida completa sta nel helpUrl).
export function remedyFor(finding) {
  const m = REMEDIATION[finding.id];
  if (m) return m;
  return {
    why: finding.help || 'Vedi la documentazione axe per il dettaglio.',
    before: finding.sampleHtml || null,
    after: null,
  };
}

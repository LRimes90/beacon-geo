// web/app/aiact/questions.mjs — testi del questionario AI Act.
// Estensione .mjs: il file è importato sia da page.jsx (webpack) sia da test.js
// (node, dove web/package.json non dichiara "type":"module").
// Separato dal JSX per due ragioni: la chiave i18n è la stringa italiana (vedi i18n.jsx)
// e così test.js può verificare che OGNI domanda del motore (QUESTIONS in
// src/aiactAssess.js) e OGNI opzione abbiano un testo — niente id nudi a schermo.
//
// `showIf` = mostra la domanda solo se un'altra risposta è vera (dipendenza logica,
// non estetica: l'art. 50 §4 c. 2 parla di revisione editoriale del testo generato,
// domanda priva di senso se non generi nulla).

export const QUESTION_TEXT = {
  euMarket: {
    kind: 'choice',
    q: 'Vendi, offri servizi o hai utenti nell’Unione europea?',
    help: 'Conta anche il caso indiretto: se il risultato del sistema di IA viene usato nell’UE, il regolamento si applica comunque (art. 2 §1 lett. c).',
    options: { yes: 'Sì', no: 'No, solo Svizzera / extra-UE', unsure: 'Non lo so' },
  },
  role: {
    kind: 'choice',
    q: 'Che ruolo hai rispetto ai sistemi di IA?',
    help: 'Deployer = usi un sistema di IA sotto la tua autorità. Fornitore = lo sviluppi o lo immetti sul mercato con il tuo nome, anche se il modello è di terzi.',
    options: {
      none: 'Nessuno: non uso IA',
      deployer: 'Lo uso (deployer)',
      provider: 'Lo sviluppo o lo immetto sul mercato (fornitore)',
      both: 'Entrambi',
    },
  },
  interaction: {
    kind: 'bool',
    q: 'Un sistema di IA interagisce direttamente con le persone?',
    help: 'Chatbot, assistente vocale, risponditore automatico sul sito o al telefono.',
  },
  syntheticContent: {
    kind: 'bool',
    q: 'Pubblichi testi, immagini, audio o video generati con IA?',
    help: 'Anche parzialmente generati o modificati.',
  },
  editorialReview: {
    kind: 'bool',
    q: 'I contenuti generati passano da una revisione umana con responsabilità editoriale?',
    help: 'Se sì, l’obbligo di dichiarare il testo generato (art. 50 §4 c. 2) non si applica: la responsabilità editoriale resta di una persona.',
    showIf: 'syntheticContent',
  },
  deepfake: {
    kind: 'bool',
    q: 'I contenuti generati raffigurano persone, luoghi o eventi reali in modo verosimile?',
    help: 'È la definizione di deep fake dell’art. 3 §60: somiglianza a persone o fatti esistenti, tale da apparire autentica.',
    showIf: 'syntheticContent',
  },
  gpai: {
    kind: 'bool',
    q: 'Sviluppi o immetti sul mercato un modello di IA per finalità generali?',
    help: 'Addestrare o distribuire un modello proprio. Usare GPT o Claude via API non ti rende fornitore del modello.',
  },
  staffUsingAi: {
    kind: 'bool',
    q: 'Ci sono persone che usano l’IA in nome della tua organizzazione?',
    help: 'Dipendenti, collaboratori, agenzie. Attiva l’obbligo di alfabetizzazione in materia di IA (art. 4), già applicabile.',
  },
  highRiskUse: {
    kind: 'multi',
    q: 'L’IA interviene in una di queste decisioni sulle persone?',
    help: 'Selezione multipla. Nessuna? Lascia tutto vuoto.',
    options: {
      hr: 'Assunzioni, selezione, valutazione o licenziamento',
      credit: 'Merito creditizio, prestiti, assicurazioni',
      education: 'Ammissione, valutazione o esami in istruzione e formazione',
      essentialServices: 'Accesso a servizi pubblici o prestazioni essenziali',
      biometrics: 'Identificazione o categorizzazione biometrica',
      criticalInfra: 'Gestione di infrastrutture critiche',
      justice: 'Giustizia, ordine pubblico, migrazione, asilo',
    },
  },
  prohibitedUse: {
    kind: 'multi',
    q: 'Il sistema fa una di queste cose?',
    help: 'Pratiche vietate dall’art. 5, in divieto dal 2 febbraio 2025. Selezione multipla.',
    options: {
      emotionWorkplace: 'Riconosce emozioni sul lavoro o a scuola',
      socialScoring: 'Assegna un punteggio sociale alle persone',
      faceScraping: 'Raccoglie volti in massa dal web o dalle telecamere',
      subliminal: 'Usa tecniche subliminali o sfrutta vulnerabilità (età, disabilità, condizione economica)',
      predictivePolicing: 'Prevede il rischio che una persona commetta un reato',
    },
  },
};

// Le due domande senza cui il verdetto non ha basi: chi sei e dove operi.
export const REQUIRED = ['euMarket', 'role'];

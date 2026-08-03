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
//
// Tre livelli di testo per domanda, perché un questionario giuridico sbagliato non
// è sbagliato per cattiva volontà, è sbagliato perché la domanda non era chiara:
//   q       = la domanda
//   help    = la riga sotto: il criterio in una frase
//   detail  = cosa significa davvero, in parole semplici, e cosa cambia la risposta
//   examples = casi concreti generici con la risposta attesa (chiusi in <details>)

export const QUESTION_TEXT = {
  euMarket: {
    kind: 'choice',
    q: 'Vendi, offri servizi o hai utenti nell’Unione europea?',
    help: 'Conta anche il caso indiretto: se il risultato del sistema di IA viene usato nell’UE, il regolamento si applica comunque (art. 2 §1 lett. c).',
    detail: 'L’AI Act non guarda dove hai la sede, ma dove finisce il risultato del sistema. Una società svizzera senza filiali nell’Unione ci rientra comunque se l’output — la risposta al cliente, il preventivo, la selezione di candidati, il testo pubblicato — viene usato nell’UE. È la ragione per cui questa è la prima domanda: da sola decide metà del verdetto.',
    examples: [
      'Studio di Lugano che manda a un’azienda italiana un preventivo preparato con l’IA → Sì: l’output è usato nell’Unione',
      'Negozio online con prezzi in euro e spedizioni in tutta Europa → Sì',
      'Ristorante con chatbot in italiano, clientela locale, nessuna vendita all’estero → No, solo Svizzera',
      'Non sai dove siano i clienti finali del tuo committente → Non lo so: è il caso più frequente, e il tool lo tratta come «probabilmente dentro» invece di assolverti',
    ],
    options: { yes: 'Sì', no: 'No, solo Svizzera / extra-UE', unsure: 'Non lo so' },
  },
  role: {
    kind: 'choice',
    q: 'Che ruolo hai rispetto ai sistemi di IA?',
    help: 'Deployer = usi un sistema di IA sotto la tua autorità. Fornitore = lo sviluppi o lo immetti sul mercato con il tuo nome, anche se il modello è di terzi.',
    detail: 'È la distinzione più fraintesa del regolamento, e quella che pesa di più: al fornitore l’AI Act chiede documentazione tecnica, gestione del rischio e conformità del sistema; al deployer chiede uso corretto, sorveglianza umana e trasparenza verso le persone. Il confine non è tecnico ma di responsabilità: conta di chi è il nome sul sistema offerto agli altri. Attenzione all’art. 25: se metti il tuo marchio su un sistema di terzi, o ne modifichi la finalità, il fornitore diventi tu.',
    examples: [
      'Metti sul sito un chatbot commerciale in abbonamento → Lo uso (deployer): il fornitore è chi te lo vende',
      'Chiami l’API di un modello dentro il tuo software, per lavorare meglio tu → Lo uso (deployer)',
      'Confezioni un assistente per i tuoi clienti e lo offri col tuo marchio → Fornitore, anche se il modello sotto è di altri (art. 25)',
      'Usi l’IA in azienda e in più vendi ai clienti uno strumento tuo che la contiene → Entrambi: gli obblighi si sommano, non si scelgono',
    ],
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
    detail: 'La domanda riguarda i sistemi che si rivolgono a una persona in prima persona, non l’automazione in generale. Se la risposta è sì, l’art. 50 §1 chiede che la persona sappia di parlare con una macchina — al primo contatto e dentro il widget stesso, non in una riga della privacy policy. L’unica eccezione è quando è palese per chiunque: un pulsante «assistente automatico» non ha bisogno di ulteriori avvisi.',
    examples: [
      'Chatbot di assistenza in basso a destra sul sito → Sì',
      'Risponditore telefonico che capisce le frasi e fissa appuntamenti → Sì',
      'Form di contatto che invia una mail di conferma automatica → No: è automazione, non un sistema di IA che dialoga',
      'Chatbot che si presenta con un nome di persona e non dice di essere un bot → Sì, ed è precisamente il caso che l’art. 50 §1 vuole impedire',
    ],
  },
  syntheticContent: {
    kind: 'bool',
    q: 'Pubblichi testi, immagini, audio o video generati con IA?',
    help: 'Anche parzialmente generati o modificati.',
    detail: 'Conta la generazione, non il ritocco: correggere luce e colore di una tua foto non è contenuto sintetico, farsi produrre l’immagine dal nulla sì. Se rispondi sì scattano due obblighi diversi che vengono spesso confusi: la marcatura leggibile dalle macchine (art. 50 §2, metadati nel file) e l’informazione al pubblico (art. 50 §4, la persona che legge o guarda).',
    examples: [
      'Immagini di copertina del blog generate con Midjourney o DALL·E → Sì',
      'Articoli scritti dall’IA e poi rimaneggiati → Sì (la revisione conta sull’art. 50 §4 c. 2, non ti esonera dalla §2)',
      'Fotografie tue con esposizione e colore corretti → No: la correzione non è generazione',
      'Sottotitoli o voce fuori campo generati automaticamente → Sì',
    ],
  },
  editorialReview: {
    kind: 'bool',
    q: 'I contenuti generati passano da una revisione umana con responsabilità editoriale?',
    help: 'Se sì, l’obbligo di dichiarare il testo generato (art. 50 §4 c. 2) non si applica: la responsabilità editoriale resta di una persona.',
    detail: 'Il regolamento non chiede una firma formale, chiede che qualcuno risponda del contenuto: leggerlo, correggerlo, decidere di pubblicarlo. Un’occhiata veloce prima di premere «pubblica» non è responsabilità editoriale. Vale solo per il testo destinato a informare il pubblico su questioni di interesse pubblico: non è un’esenzione generale dagli obblighi di trasparenza.',
    examples: [
      'Bozza dell’IA riscritta e pubblicata sotto la firma di un redattore → Sì',
      'Post pubblicati da uno script secondo un calendario, senza che nessuno li legga → No',
      'Newsletter generata e riletta dal titolare prima dell’invio → Sì',
    ],
    showIf: 'syntheticContent',
  },
  deepfake: {
    kind: 'bool',
    showIf: 'syntheticContent',
    q: 'I contenuti generati raffigurano persone, luoghi o eventi reali in modo verosimile?',
    help: 'È la definizione di deep fake dell’art. 3 §60: somiglianza a persone o fatti esistenti, tale da apparire autentica.',
    detail: 'Servono due condizioni insieme: che il soggetto esista davvero e che il risultato possa essere preso per autentico. Un drago in una foresta non è un deep fake anche se sembra vero, perché il drago non esiste; il volto di un cliente che pronuncia parole mai dette lo è. Se rispondi sì, l’art. 50 §4 chiede di dichiararlo in modo chiaro e visibile a chi guarda.',
    examples: [
      'Video del volto di una persona reale che pronuncia un testo che non ha mai detto → Sì',
      'Immagine realistica di una piazza esistente con un evento mai avvenuto → Sì',
      'Illustrazione fantasy con personaggi inventati → No',
      'Voce del titolare clonata per uno spot → Sì',
    ],
  },
  gpai: {
    kind: 'bool',
    q: 'Sviluppi o immetti sul mercato un modello di IA per finalità generali?',
    help: 'Addestrare o distribuire un modello proprio. Usare GPT o Claude via API non ti rende fornitore del modello.',
    detail: 'Gli obblighi sui modelli di uso generale (art. 53-55: documentazione tecnica, sintesi dei dati di addestramento, rispetto del diritto d’autore) ricadono su chi il modello lo mette sul mercato, non su chi lo usa. Chiamare un’API resta uso: il fornitore del modello è chi lo ha addestrato e lo distribuisce. Nella pratica quasi ogni PMI risponde no a questa domanda.',
    examples: [
      'Chiami l’API di GPT, Claude o Gemini dal tuo software → No: fornitore del modello è chi lo ha addestrato',
      'Pubblichi su Hugging Face un modello addestrato da te → Sì',
      'Fai un fine-tuning sostanziale e lo distribuisci ad altri → Sì, per la parte che hai modificato',
      'Installi un modello open source sul tuo server per uso interno → No',
    ],
  },
  staffUsingAi: {
    kind: 'bool',
    q: 'Ci sono persone che usano l’IA in nome della tua organizzazione?',
    help: 'Dipendenti, collaboratori, agenzie. Attiva l’obbligo di alfabetizzazione in materia di IA (art. 4), già applicabile.',
    detail: 'È l’obbligo più sottovalutato e l’unico già applicabile dal 2 febbraio 2025. Non chiede corsi certificati né budget: chiede che chi usa l’IA per l’organizzazione sappia cosa può e non può fare, con una formazione proporzionata al contesto. Istruzioni scritte, esempi di errori da evitare, una persona di riferimento: per una piccola realtà questo è già adempimento, purché sia documentato.',
    examples: [
      'I collaboratori usano ChatGPT per preparare email ai clienti → Sì',
      'L’agenzia che gestisce i tuoi social scrive i testi con l’IA → Sì: agisce in tuo nome',
      'Usi la traduzione automatica per documenti che poi invii ai clienti → Sì',
      'Lavori da solo e usi l’IA solo tu → Sì: l’obbligo esiste comunque, ma è proporzionato a una persona sola',
    ],
  },
  highRiskUse: {
    kind: 'multi',
    q: 'L’IA interviene in una di queste decisioni sulle persone?',
    help: 'Selezione multipla. Se non ne riguarda nessuna, scegli «Nessuna di queste»: serve a distinguere un no da una domanda saltata.',
    detail: 'Sono gli usi ad alto rischio dell’allegato III: casi in cui una decisione automatizzata incide sull’accesso al lavoro, al credito, all’istruzione, ai servizi essenziali o sui diritti fondamentali. Gli obblighi (gestione del rischio, qualità dei dati, sorveglianza umana, registrazione) sono i più pesanti del regolamento e scattano nel 2027-2028: la domanda serve a saperlo adesso, perché adeguarsi richiede mesi, non settimane. Basta che l’IA prepari o influenzi la decisione — non serve che decida da sola.',
    examples: [
      'Software che ordina o scarta i CV ricevuti, anche solo per fare una prima cernita → Assunzioni',
      'Punteggio automatico che decide chi può pagare a rate → Merito creditizio',
      'Riconoscimento facciale per l’accesso ai locali → Identificazione biometrica',
      'Chatbot che risponde su orari, prezzi e disponibilità → Nessuna di queste',
    ],
    options: {
      none: 'Nessuna di queste',
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
    help: 'Pratiche vietate dall’art. 5, in divieto dal 2 febbraio 2025. Selezione multipla: se non ne fai nessuna, scegli «Nessuna di queste».',
    detail: 'Qui non esiste un percorso di adeguamento: le pratiche dell’art. 5 sono vietate dal 2 febbraio 2025 e un sistema che ne compie una va fermato, non messo in regola. Per un’attività commerciale la risposta normale è nessuna. Due precisazioni: il divieto sul riconoscimento delle emozioni riguarda il lavoro e la scuola e ha eccezioni ristrette per motivi medici o di sicurezza; la raccolta massiva di volti è vietata anche se le immagini sono pubbliche.',
    examples: [
      'Software che stima l’umore o l’attenzione dei dipendenti dalle telecamere → Riconosce emozioni sul lavoro',
      'Punteggio generale sulle persone, costruito su comportamenti estranei al servizio, usato per trattarle diversamente → Punteggio sociale',
      'Archivio di volti raccolti da Internet o dalle telecamere per costruire un database di riconoscimento → Raccolta di volti in massa',
      'Niente di tutto questo → Nessuna di queste: è la risposta attesa nella grande maggioranza dei casi',
    ],
    options: {
      none: 'Nessuna di queste',
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

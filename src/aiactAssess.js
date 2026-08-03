// src/aiactAssess.js — autovalutazione AI Act: ciò che uno scanner NON può vedere.
// Lo scan (src/aiact.js) legge il markup; il ruolo giuridico, la classe di rischio e
// i casi d'uso vivono nell'organizzazione, non nell'HTML. Qui li chiediamo e li
// mappiamo sugli obblighi, in modo DETERMINISTICO: nessun LLM, funzioni pure, testabili.
//
// Contesto Svizzera: non esiste una legge svizzera sull'IA. Il Consiglio federale
// (12.02.2025) ha deciso di ratificare la Convenzione del Consiglio d'Europa e di
// regolare per settori; progetto in consultazione atteso entro fine 2026. Restano
// applicabili nLPD, diritto d'autore, LCSl. L'AI Act tocca comunque chi è in CH via
// l'art. 2 §1 lett. c: se l'OUTPUT del sistema è usato nell'UE, il regolamento si applica.
//
// NON dichiara conformità: produce un perimetro e una lista di verifiche.
// Riferimenti: Reg. (UE) 2024/1689; applicabilità art. 113 come modificato dal
// pacchetto Digital Omnibus (alto rischio rinviato: 02.12.2027 / 02.08.2028).

import { makeT } from './messages/index.js';

// ── Scadenze di applicabilità ───────────────────────────────────────────────
export const DATES = {
  prohibited: '2025-02-02',   // art. 5 pratiche vietate + art. 4 alfabetizzazione
  gpai: '2025-08-02',         // modelli di uso generale
  transparency: '2026-08-02', // art. 50 + governance + sanzioni (art. 99)
  highRiskStandalone: '2027-12-02',
  highRiskEmbedded: '2028-08-02',
};

// ── Questionario (guida anche la UI: le domande stanno qui, non nel JSX) ─────
export const QUESTIONS = [
  { id: 'euMarket', kind: 'choice', options: ['yes', 'no', 'unsure'] },
  { id: 'role', kind: 'choice', options: ['none', 'deployer', 'provider', 'both'] },
  { id: 'interaction', kind: 'bool' },      // chatbot/voicebot verso persone
  { id: 'syntheticContent', kind: 'bool' }, // testo/immagini/audio/video generati
  { id: 'editorialReview', kind: 'bool' },  // revisione umana con responsabilità editoriale
  { id: 'deepfake', kind: 'bool' },         // persone/luoghi/eventi reali, verosimili
  { id: 'gpai', kind: 'bool' },             // sviluppi/immetti un modello di uso generale
  { id: 'staffUsingAi', kind: 'bool' },     // persone che usano IA in nome tuo
  {
    id: 'highRiskUse', kind: 'multi',
    options: ['hr', 'credit', 'education', 'essentialServices', 'biometrics', 'criticalInfra', 'justice'],
  },
  {
    id: 'prohibitedUse', kind: 'multi',
    options: ['emotionWorkplace', 'socialScoring', 'faceScraping', 'subliminal', 'predictivePolicing'],
  },
];

// ── Catalogo obblighi ───────────────────────────────────────────────────────
// `severity`: 'blocking' = da fermare subito · 'due' = obbligo attivo · 'future' = scadenza futura.
export const OBLIGATIONS = {
  art5: { ref: 'art. 5', from: DATES.prohibited, severity: 'blocking' },
  art4: { ref: 'art. 4', from: DATES.prohibited, severity: 'due' },
  art50_1: { ref: 'art. 50 §1', from: DATES.transparency, severity: 'due' },
  art50_2: { ref: 'art. 50 §2', from: DATES.transparency, severity: 'due' },
  art50_4_deepfake: { ref: 'art. 50 §4', from: DATES.transparency, severity: 'due' },
  art50_4_text: { ref: 'art. 50 §4 c. 2', from: DATES.transparency, severity: 'due' },
  gpai: { ref: 'art. 53-55', from: DATES.gpai, severity: 'due' },
  highRiskProvider: { ref: 'art. 8-17', from: DATES.highRiskStandalone, severity: 'future' },
  highRiskDeployer: { ref: 'art. 26-27', from: DATES.highRiskStandalone, severity: 'future' },
  nldp: { ref: 'nLPD art. 19-21 · GDPR art. 13-14, 22', from: 'in vigore', severity: 'due' },
};

// Ricava gli obblighi dalle risposte + dai segnali dello scan (funzione PURA).
// I segnali dello scan possono ATTIVARE un obbligo che l'utente non ha dichiarato:
// se troviamo un chatbot in pagina, l'art. 50 §1 entra in lista anche se ha risposto "no".
export function deriveObligations(answers = {}, signals = null) {
  const a = answers;
  const s = signals || {};
  const hasBotOnPage = !!(s.chatbots && s.chatbots.length);
  const hasEmotionOnPage = !!(s.emotion && s.emotion.length);
  const usesAi = a.role === 'deployer' || a.role === 'provider' || a.role === 'both';
  const isProvider = a.role === 'provider' || a.role === 'both';
  const prohibited = (a.prohibitedUse || []).filter((x) => x !== 'none');
  const highRisk = (a.highRiskUse || []).filter((x) => x !== 'none');

  const out = [];
  const add = (id, why) => out.push({ id, ...OBLIGATIONS[id], why });

  if (prohibited.length) add('art5', prohibited.join(', '));
  else if (hasEmotionOnPage) add('art5', 'scan: ' + s.emotion.join(', '));

  if (usesAi || a.staffUsingAi) add('art4', 'uso di IA in nome dell’organizzazione');

  if (a.interaction || hasBotOnPage) {
    add('art50_1', hasBotOnPage ? 'scan: ' + s.chatbots.join(', ') : 'dichiarato');
  }
  if (isProvider && a.syntheticContent) add('art50_2', 'fornitore di sistema generativo');
  if (a.deepfake) add('art50_4_deepfake', 'contenuti verosimili su persone/eventi reali');
  if (a.syntheticContent && !a.editorialReview) add('art50_4_text', 'nessuna responsabilità editoriale dichiarata');
  if (a.gpai) add('gpai', 'modello di uso generale');
  if (highRisk.length) {
    add(isProvider ? 'highRiskProvider' : 'highRiskDeployer', highRisk.join(', '));
  }
  // Sempre: la protezione dati non dipende dall'AI Act.
  if (usesAi) add('nldp', 'trattamento di dati personali tramite IA');

  return out;
}

// ── Verdetto di ambito ──────────────────────────────────────────────────────
// Due assi indipendenti, come vuole l'art. 2: ambito MATERIALE (esiste un sistema IA?)
// e ambito TERRITORIALE (c'è un nesso con l'Unione?). Il verdetto è il MINIMO dei due:
// senza IA il territorio è irrilevante, e viceversa.
//
// Principio di risoluzione dei conflitti, dichiarato perché è una scelta e non un fatto:
//   lo SCAN è prova di ESISTENZA, l'UTENTE è fonte sull'INTENZIONE.
// Se lo scan trova un chatbot, quel chatbot esiste anche se l'utente ha risposto "nessuna
// IA": l'ambito materiale sale. Se invece l'utente dice "non vendo nell'UE", lo scan non
// può smentirlo (hreflang e prezzi in € sono indizi di pubblico, non prova di mercato):
// non lo sovrascriviamo mai in silenzio — alziamo il livello a 'likely' ed esponiamo i
// segnali in `reasons`, perché la persona verifichi. Sbagliare per difetto costa al
// cliente fino a 15 M€ o il 3% del fatturato (art. 99); sbagliare per eccesso costa
// una verifica in più. L'asimmetria giustifica la prudenza, non l'allarmismo.
const SCOPE_ORDER = { out: 0, unlikely: 1, likely: 2, in: 3 };
const CONF_ORDER = { low: 0, medium: 1, high: 2 };
const minScope = (a, b) => (SCOPE_ORDER[a] <= SCOPE_ORDER[b] ? a : b);
const minConf = (a, b) => (CONF_ORDER[a] <= CONF_ORDER[b] ? a : b);

// Peso dei segnali di mercato UE. Forti = indicano una scelta commerciale deliberata.
// Deboli = compatibili con un sito svizzero qualsiasi: un banner "GDPR" in CH è la norma
// (la nLPD è simile), e un link a un dominio .it/.de può essere una fonte citata.
const STRONG_EU_SIGNALS = new Set(['hreflang UE', 'partita IVA / VAT UE', 'prezzi in euro']);
const EU_IN_THRESHOLD = 2;       // ≥2 punti con euMarket='unsure' → dentro
const EU_CONTRADICT_THRESHOLD = 4; // ≥4 punti che contraddicono un "no" → 'likely'

export function euEvidence(signals) {
  const list = (signals && signals.euSignals) || [];
  return list.reduce((n, s) => n + (STRONG_EU_SIGNALS.has(s) ? 2 : 1), 0);
}

export function decideVerdict(answers = {}, signals = null, obligations = []) {
  const a = answers;
  const s = signals || null;
  const reasons = [];

  const aiOnPage = !!(s && ((s.chatbots && s.chatbots.length) || (s.emotion && s.emotion.length)));
  const declaresAi = a.role === 'deployer' || a.role === 'provider' || a.role === 'both';
  const blocking = obligations.some((o) => o.severity === 'blocking');
  const declaredProhibited = (a.prohibitedUse || []).filter((x) => x !== 'none').length > 0;

  // ── Asse materiale ──
  let material, materialConf;
  let contradiction = false;
  if (declaresAi || a.gpai) {
    material = 'in';
    materialConf = 'high';
  } else if (aiOnPage) {
    // Contraddizione: l'utente dice "nessuna IA", la pagina mostra il contrario.
    material = 'likely';
    materialConf = 'low';
    contradiction = true;
    const found = [...((s && s.chatbots) || []), ...((s && s.emotion) || [])];
    reasons.push({ key: 'contradictionAi', detail: found.join(', ') });
  } else if (a.role === 'none') {
    material = 'out';
    materialConf = s ? 'high' : 'medium'; // senza scan resta la parola dell'utente
  } else {
    material = 'unlikely';
    materialConf = 'low';
    reasons.push({ key: 'roleMissing' });
  }

  // ── Asse territoriale ──
  const eu = euEvidence(s);
  const euList = (s && s.euSignals) || [];
  let territorial, territorialConf;
  if (a.euMarket === 'yes') {
    territorial = 'in';
    territorialConf = 'high';
    reasons.push({ key: 'euDeclared' });
  } else if (a.euMarket === 'no') {
    if (eu >= EU_CONTRADICT_THRESHOLD) {
      territorial = 'likely';
      territorialConf = 'medium';
      reasons.push({ key: 'euContradiction', detail: euList.join(', ') });
    } else if (eu >= EU_IN_THRESHOLD) {
      territorial = 'unlikely';
      territorialConf = 'low';
      reasons.push({ key: 'euWeakSignals', detail: euList.join(', ') });
    } else {
      territorial = 'out';
      territorialConf = s ? 'high' : 'medium';
      reasons.push({ key: 'euExcluded' });
    }
  } else {
    // 'unsure' (o risposta assente) = il caso normale per un'attività svizzera che
    // lavora anche con clienti italiani. Livello proprio: né allarme né via libera.
    if (eu >= EU_IN_THRESHOLD) {
      territorial = 'in';
      territorialConf = 'medium';
      reasons.push({ key: 'euUnsureWithSignals', detail: euList.join(', ') });
    } else {
      territorial = 'likely';
      territorialConf = 'low';
      reasons.push({ key: 'euUnsure' });
    }
  }

  const scope = minScope(material, territorial);
  const confidence = minConf(materialConf, territorialConf);

  // Le pratiche vietate scavalcano il verdetto di ambito: se il sistema fa social
  // scoring o legge emozioni sul lavoro, il problema esiste anche fuori dall'UE
  // (in CH: nLPD, LCSl, diritto del lavoro). Titolo dedicato, mai annacquato.
  // La contraddizione vince sempre sul livello d'ambito, anche quando l'ambito è
  // 'out': dire "fuori dall'AI Act" a chi ha risposto "non uso IA" mentre la pagina
  // monta un chatbot significa confermargli una risposta sbagliata. Il titolo deve
  // dire ciò che si è osservato, non la conclusione più comoda.
  const headline = blocking ? 'blocking' : contradiction ? 'contradiction' : scope;

  return {
    scope,
    confidence: blocking && declaredProhibited ? 'high' : confidence,
    headline,
    blocking,
    material,
    territorial,
    euEvidence: eu,
    scanned: !!s,
    reasons,
  };
}

// Assemblaggio finale (puro): perimetro + obblighi + scadenze, MAI una dichiarazione
// di conformità. La logica di decisione sopra resta senza i18n (dati, non testo):
// la traduzione avviene solo qui, così i test verificano le decisioni, non le stringhe.
const SEVERITY_ORDER = { blocking: 0, due: 1, conditional: 2, future: 3 };

// `today` è un parametro e non una chiamata a new Date() dentro la logica: le date
// dell'art. 113 scadono una dopo l'altra, e un motore che le legge dall'orologio di
// sistema non è verificabile. Così i test possono asserire il 2027 senza mock.
export function assessAiAct(answers = {}, signals = null, lang = 'it', today = new Date().toISOString().slice(0, 10)) {
  const t = makeT(lang);
  const raw = deriveObligations(answers, signals);
  const verdict = decideVerdict(answers, signals, raw);

  // Fuori dall'ambito gli obblighi dell'AI Act non sono esigibili: restano in
  // elenco ma come 'conditional' ("si applicherebbero con un nesso UE"), perché
  // quel 'out' poggia sulla parola dell'utente e non su una prova. Due eccezioni
  // che non si annacquano mai: la nLPD vale in Svizzera comunque, e il divieto
  // dell'art. 5 resta un problema anche fuori dall'Unione.
  const outOfScope = verdict.scope === 'out';
  const obligations = raw
    .map((o) => {
      // `from` è una data statica: dire "dal 2026-08-02" il 3 agosto 2026 fa sembrare
      // una scadenza futura un obbligo già esigibile. Confronto lessicografico: ISO 8601
      // è ordinato come stringa, niente Date da costruire né fusi da sbagliare.
      const inForce = o.from === 'in vigore' || o.from <= today;
      // Un obbligo 'future' la cui data è passata NON è più futuro: senza questa riga
      // il 2 dicembre 2027 l'alto rischio resterebbe marcato come scadenza lontana.
      const matured = o.severity === 'future' && inForce ? 'due' : o.severity;
      return {
        ...o,
        inForce,
        severity: outOfScope && matured === 'due' && o.id !== 'nldp' ? 'conditional' : matured,
        label: t('aiact.ob.' + o.id),
      };
    })
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  return {
    module: 'aiactAssess',
    verdict: {
      ...verdict,
      title: t('aiact.verdict.' + verdict.headline),
      reasons: verdict.reasons.map((r) => t('aiact.reason.' + r.key, { detail: r.detail })),
    },
    obligations,
    // Ciò che è già in vigore, separato da ciò che scade nel 2027-28.
    due: obligations.filter((o) => o.severity === 'blocking' || o.severity === 'due').map((o) => o.id),
    dates: DATES,
    // Onestà, come in src/statement.js: questo è un perimetro, non un parere legale.
    disclaimer: t('aiact.assess.disclaimer'),
  };
}

export const ASSESS_LABEL = 'Autovalutazione AI Act';

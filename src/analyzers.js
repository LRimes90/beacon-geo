// src/analyzers.js — i 5+1 analizzatori come FUNZIONI PURE.
// Ognuna riceve dati già raccolti (niente rete qui: così sono testabili con assert)
// e ritorna { score: 0-100, checks: [{name, status, detail, fix?}] }.
// status: 'good' | 'warn' | 'crit' | 'info'
// i18n: ogni analyzer accetta `lang` (default 'it') e legge le stringhe dal
// catalogo src/messages/ — la logica di punteggio resta identica.
import { getTitle, getMeta, jsonLdTypes, jsonLdCount, semanticRatio, headings, imgAlt, wordCount, links, sections, extractableBlocks, paragraphWords, citableEvidence, htmlLang, stripTags, contentWords } from './lib.js';
import { makeT } from './messages/index.js';

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const pct = (a, b) => (b ? (a / b) * 100 : 0);

// ① ACCESSO AI — quota di crawler ammessi dal robots.txt + che raggiungono la pagina live.
export function analyzeAccess({ robotsAllowed, liveFetch }, lang = 'it') {
  const t = makeT(lang);
  const total = Object.keys(robotsAllowed).length || 1;
  const allowed = Object.values(robotsAllowed).filter(Boolean).length;
  const liveTotal = Object.keys(liveFetch).length || 1;
  const liveOk = Object.values(liveFetch).filter((r) => r.ok).length;
  const score = clamp(0.6 * pct(allowed, total) + 0.4 * pct(liveOk, liveTotal));
  const st = (p) => (p >= 0.9 ? 'good' : p >= 0.5 ? 'warn' : 'crit');
  return {
    score,
    checks: [
      { name: t('access.robots.name'), status: st(allowed / total),
        detail: t('access.robots.detail', { allowed, total }),
        fix: allowed < total ? t('access.robots.fix') : null },
      { name: t('access.live.name'), status: st(liveOk / liveTotal),
        detail: t('access.live.detail', { ok: liveOk, total: liveTotal }),
        fix: liveOk < liveTotal ? t('access.live.fix') : null },
    ],
  };
}

// ② FILE PER AGENTI E AI — file base + standard emergenti.
export function analyzeAgentFiles(files, lang = 'it') {
  const t = makeT(lang);
  // files: { robotsTxt, sitemap, llmsTxt, skillMd, mcpJson, agentSkills } (bool)
  const base = ['robotsTxt', 'sitemap', 'llmsTxt'];
  const emerging = ['skillMd', 'mcpJson', 'agentSkills'];
  const baseHave = base.filter((k) => files[k]).length;
  const emHave = emerging.filter((k) => files[k]).length;
  // Base pesa 70, emergenti 30 (bonus: sei in anticipo sulla concorrenza).
  const score = clamp(0.7 * pct(baseHave, base.length) + 0.3 * pct(emHave, emerging.length));
  return {
    score,
    checks: [
      { name: t('agentFiles.base.name'), status: baseHave === 3 ? 'good' : baseHave >= 2 ? 'warn' : 'crit',
        detail: t('agentFiles.base.detail', { have: baseHave }) + (!files.llmsTxt ? t('agentFiles.base.missingLlms') : ''),
        fix: !files.llmsTxt ? t('agentFiles.base.fix') : null },
      { name: t('agentFiles.emerging.name'), status: emHave ? 'good' : 'info',
        detail: t('agentFiles.emerging.detail', { have: emHave }),
        fix: emHave === 0 ? t('agentFiles.emerging.fix') : null },
    ],
  };
}

// Etichette dei segnali meta: identiche in ogni lingua, quindi restano fuori dai dizionari.
// I mancanti sono marcati con "!" così il dettaglio dice *quale* segnale manca, non solo quanti.
const SIGNAL_LABELS = (signals) => {
  const label = { canonical: 'canonical', hreflang: 'hreflang', og: 'OG', twitter: 'Twitter' };
  return Object.entries(signals).map(([k, ok]) => (ok ? label[k] : label[k] + '!')).join(', ');
};

// ③ DATI STRUTTURATI E SEO
export function analyzeStructured(html, lang = 'it') {
  const t = makeT(lang);
  const title = getTitle(html) || '';
  const desc = getMeta(html, 'description') || '';
  const types = jsonLdTypes(html);
  const okTitle = title.length >= 15 && title.length <= 65;
  const okDesc = desc.length >= 50 && desc.length <= 160;
  // hreflang ha senso solo su siti multilingue: pretenderlo da un sito in una sola
  // lingua spinge ad aggiungere un alternate autoreferenziale che non dice nulla a
  // nessuno. Sta nel denominatore solo se la pagina dichiara altre lingue.
  const multilingual = /<meta[^>]+property=["\']og:locale:alternate["\']/i.test(html)
    || /<link[^>]+rel=["\']alternate["\'][^>]+hreflang=/i.test(html);
  const signals = {
    canonical: /<link[^>]+rel=["\']canonical["\']/i.test(html),
    og: /<meta[^>]+property=["\']og:/i.test(html),
    twitter: /<meta[^>]+name=["\']twitter:/i.test(html),
  };
  if (multilingual) {
    signals.hreflang = /<link[^>]+rel=["\']alternate["\'][^>]+hreflang=/i.test(html);
  }
  const sigTotal = Object.keys(signals).length;
  const sigHave = Object.values(signals).filter(Boolean).length;
  const score = clamp((okTitle ? 20 : title ? 10 : 0) + (okDesc ? 20 : desc ? 10 : 0) + (types.length ? 30 : 0) + pct(sigHave, sigTotal) * 0.3);
  return {
    score,
    checks: [
      { name: t('structured.meta.name'), status: okTitle && okDesc ? 'good' : 'warn',
        detail: t('structured.meta.detail', { title: title.length, desc: desc.length }),
        fix: !okTitle || !okDesc ? t('structured.meta.fix') : null },
      { name: t('structured.jsonld.name'), status: types.length ? 'good' : 'crit',
        detail: types.length ? t('structured.jsonld.detail', { count: jsonLdCount(html), types: types.join(', ') }) : t('structured.jsonld.none'),
        fix: !types.length ? t('structured.jsonld.fix') : null },
      { name: t('structured.signals.name'), status: sigHave === sigTotal ? 'good' : sigHave >= 1 ? 'warn' : 'crit',
        detail: t('structured.signals.detail', { have: sigHave, total: sigTotal, names: SIGNAL_LABELS(signals) }),
        fix: sigHave < sigTotal ? t('structured.signals.fix') : null },
    ],
  };
}

// ④ LEGGIBILITÀ PER LE MACCHINE — calcolata su HTML servito; se disponibile, confronta col post-render.
export function analyzeReadability({ served, rendered }, lang = 'it') {
  const t = makeT(lang);
  const s = readabilityMetrics(served);
  // Ogni termine è già in scala (max 30/30/20/20 = 100). pct() ritorna 0-100 → moltiplica per 0.x per riportare in scala.
  const score = clamp(
    (s.words >= 300 ? 30 : pct(s.words, 300) * 0.3) +
    (s.ratio >= 0.05 ? 30 : pct(s.ratio, 0.05) * 0.3) +
    (s.h1 === 1 ? 20 : s.h1 > 1 ? 10 : 0) +
    (s.imgTotal ? pct(s.imgAlt, s.imgTotal) * 0.2 : 20)
  );
  const checks = [
    { name: t('readability.words.name'), status: s.words >= 300 ? 'good' : s.words >= 100 ? 'warn' : 'crit',
      detail: t('readability.words.detail', { words: s.words }),
      fix: s.words < 300 ? t('readability.words.fix') : null },
    { name: t('readability.semantic.name'), status: s.ratio >= 0.05 ? 'good' : s.ratio >= 0.02 ? 'warn' : 'crit',
      detail: t('readability.semantic.detail', { pct: (s.ratio * 100).toFixed(1), semantic: s.semantic, total: s.total }),
      fix: s.ratio < 0.05 ? t('readability.semantic.fix') : null },
    { name: t('readability.headings.name'), status: s.h1 === 1 ? 'good' : 'warn',
      detail: t('readability.headings.detail', { h1: s.h1, total: s.hTotal }),
      fix: s.h1 !== 1 ? t('readability.headings.fix') : null },
    { name: t('readability.alt.name'), status: !s.imgTotal || s.imgAlt === s.imgTotal ? 'good' : 'warn',
      detail: t('readability.alt.detail', { withAlt: s.imgAlt, total: s.imgTotal }),
      fix: s.imgTotal && s.imgAlt < s.imgTotal ? t('readability.alt.fix') : null },
  ];
  // 🆕 differenziatore: delta no-JS vs post-render
  if (rendered) {
    const r = readabilityMetrics(rendered);
    const gain = r.words - s.words;
    checks.push({
      name: t('readability.jsdelta.name'),
      status: gain > s.words * 0.5 ? 'crit' : gain > 50 ? 'warn' : 'good',
      detail: t('readability.jsdelta.detail', { gain, served: s.words, rendered: r.words }),
      fix: gain > 50 ? t('readability.jsdelta.fix') : null,
    });
  }
  return { score, checks };
}
function readabilityMetrics(html) {
  const sr = semanticRatio(html);
  const h = headings(html);
  const alt = imgAlt(html);
  return {
    words: wordCount(html), semantic: sr.semantic, total: sr.total, ratio: sr.ratio,
    h1: h.h1, hTotal: Object.values(h).reduce((a, b) => a + b, 0),
    imgTotal: alt.total, imgAlt: alt.withAlt,
  };
}

// ⑥ RISPOSTA PRONTA PER LE AI (answer-readiness) — il pilastro editoriale del GEO:
// non «una macchina vede il testo» (readability) ma «il testo risponde a una domanda
// in una forma estraibile e citabile». Base empirica dei pesi in weights.json.

// Parole interrogative per lingua. Sono DATI, non stringhe di interfaccia: stanno qui
// e non in src/messages/, che è il catalogo dei testi mostrati all'utente.
// Solo forme non ambigue a inizio titolo: 'o'/'que'/'is' da soli darebbero falsi
// positivi su qualsiasi titolo che inizia con un articolo, quindi si usano i bigrammi.
export const QUESTION_WORDS = {
  it: ['come', 'cosa', 'cos\'è', 'perché', 'perche', 'quando', 'quanto', 'quanta', 'quanti', 'quante', 'quale', 'quali', 'chi', 'dove', 'che cos'],
  en: ['how', 'what', 'why', 'when', 'where', 'who', 'which', 'can i', 'can you', 'do i', 'does it', 'is it', 'should i'],
  de: ['wie', 'was', 'warum', 'wann', 'wo', 'wer', 'welche', 'welcher', 'welches', 'wieso', 'weshalb'],
  fr: ['comment', 'pourquoi', 'quand', 'où', 'qui', 'quel', 'quelle', 'quels', 'quelles', 'combien', 'qu\'est-ce'],
  es: ['cómo', 'como', 'por qué', 'por que', 'cuándo', 'cuando', 'dónde', 'donde', 'quién', 'quien', 'cuál', 'cual', 'cuánto', 'cuanto', 'qué es'],
  pt: ['como', 'por que', 'porquê', 'quando', 'onde', 'quem', 'qual', 'quais', 'quanto', 'quantos', 'o que'],
};

// Stopword ad alta frequenza per il fallback di lingua. ponytail: euristica a
// conteggio, non un identificatore statistico — basta a distinguere sei lingue
// europee su una pagina intera; un langid vero è la via d'uscita se serve di più.
const LANG_HINTS = {
  it: [' il ', ' la ', ' che ', ' di ', ' non ', ' per ', ' una '],
  en: [' the ', ' and ', ' of ', ' to ', ' is ', ' that ', ' with '],
  de: [' der ', ' die ', ' das ', ' und ', ' ist ', ' nicht ', ' für '],
  fr: [' le ', ' la ', ' les ', ' des ', ' est ', ' pour ', ' que '],
  es: [' el ', ' la ', ' los ', ' que ', ' de ', ' para ', ' con '],
  pt: [' o ', ' os ', ' que ', ' de ', ' para ', ' com ', ' não '],
};

// Lingua della PAGINA: <html lang> se c'è, altrimenti la lingua le cui stopword
// compaiono più spesso nel testo. Il `lang` del report non decide: un sito italiano
// analizzato con report in inglese va valutato con le parole interrogative italiane.
export function pageLang(html, fallback = 'it') {
  const declared = htmlLang(html);
  if (declared && QUESTION_WORDS[declared]) return declared;
  const text = (' ' + stripTags(html).toLowerCase() + ' ');
  let best = null, bestScore = 0;
  for (const [lang, hints] of Object.entries(LANG_HINTS)) {
    const n = hints.reduce((a, h) => a + (text.split(h).length - 1), 0);
    if (n > bestScore) { bestScore = n; best = lang; }
  }
  return bestScore >= 3 && best ? best : fallback;
}

// Titoli di menu comunissimi ("Chi siamo", "Quem somos") che iniziano come una parola
// interrogativa ma sono un titolo in terza persona plurale, non una domanda — falso
// positivo trovato in review 1 su una pagina aziendale reale. Frasi intere, non parole:
// "Come raggiungerci" resta escluso ma "Come funziona" (vera domanda) resta riconosciuto.
const NON_QUESTION_HEADINGS = {
  it: ['chi siamo', 'dove siamo', 'come raggiungerci'],
  pt: ['quem somos'],
};

// Un titolo è in forma di domanda se finisce con "?" o se inizia con una parola
// interrogativa della lingua della pagina, confrontata su parola intera.
export function isQuestionHeading(text, lang = 'it') {
  const s = String(text || '').trim().toLowerCase();
  if (!s) return false;
  if ((NON_QUESTION_HEADINGS[lang] || []).includes(s)) return false;
  if (s.endsWith('?')) return true;
  const words = QUESTION_WORDS[lang] || QUESTION_WORDS.it;
  return words.some((w) => s === w || s.startsWith(w + ' ') || s.startsWith(w + '\''));
}

const MIN_WORDS_ANSWERABILITY = 300;

export function analyzeAnswerability({ served, host }, lang = 'it') {
  const t = makeT(lang);
  // contentWords, non wordCount: il gate delle 300 e il denominatore /500 devono
  // girare sul contenuto reale, non su menu/testata/footer (review 1, finding critico).
  const words = contentWords(served || '');

  // Sotto le 300 parole non c'è contenuto da giudicare: home vetrina, listing,
  // pagina contatti. `unmeasured` esce dalla media pesata (vedi audit.js) — stesso
  // meccanismo già usato da analyzeOffsite quando Common Crawl non risponde:
  // «non ho i presupposti per giudicare» ≠ «il sito è fatto male».
  if (words < MIN_WORDS_ANSWERABILITY) {
    return {
      unmeasured: true,
      score: 0,
      checks: [{ name: t('answerability.unmeasured.name'), status: 'info', detail: t('answerability.unmeasured.detail', { words }) }],
    };
  }

  const pLang = pageLang(served, lang);
  const secs = sections(served);
  const blocks = extractableBlocks(served);
  const paras = paragraphWords(served);
  const ev = citableEvidence(served, host);

  // ① risposta diretta dopo l'heading (25). Mediana e non media: una sola sezione
  // con un cappello lungo non deve affossare una pagina per il resto pulita.
  // Con un numero pari di sezioni la mediana è la media dei due valori centrali
  // (review 1: l'indice singolo dava il valore superiore, non la mediana vera).
  const lens = secs.map((s) => s.firstSentenceWords).filter((n) => n > 0).sort((a, b) => a - b);
  const mid = lens.length / 2;
  const median = lens.length === 0 ? null
    : lens.length % 2 === 1 ? lens[Math.floor(mid)]
    : Math.round((lens[mid - 1] + lens[mid]) / 2);
  const directPts = median === null ? 12 : median <= 30 ? 25 : median <= 50 ? 14 : 4;
  const directStatus = median === null ? 'info' : median <= 30 ? 'good' : median <= 50 ? 'warn' : 'crit';

  // ② blocchi estraibili (20): almeno uno ogni 500 parole.
  const per500 = blocks.total / Math.max(1, words / 500);
  const blocksPts = per500 >= 1 ? 20 : per500 >= 0.5 ? 11 : blocks.total ? 5 : 0;
  const blocksStatus = per500 >= 1 ? 'good' : per500 >= 0.5 ? 'warn' : 'crit';

  // ③ paragrafi digeribili (20): meno del 10% oltre le 120 parole.
  const longRatio = paras.total ? paras.long / paras.total : 0;
  const parasPts = !paras.total ? 8 : longRatio < 0.1 ? 20 : longRatio < 0.25 ? 11 : 3;
  const parasStatus = !paras.total ? 'warn' : longRatio < 0.1 ? 'good' : longRatio < 0.25 ? 'warn' : 'crit';

  // ④ titoli in forma di domanda (15): almeno un quarto degli H2/H3.
  const qHave = secs.filter((s) => isQuestionHeading(s.heading, pLang)).length;
  const qRatio = secs.length ? qHave / secs.length : 0;
  const qPts = qRatio >= 0.25 ? 15 : qRatio >= 0.1 ? 8 : 0;
  const qStatus = qRatio >= 0.25 ? 'good' : qRatio >= 0.1 ? 'warn' : secs.length ? 'crit' : 'info';

  // ⑤ evidenza citabile (20): almeno tre elementi fra dati, citazioni e fonti.
  const evPts = ev.total >= 3 ? 20 : ev.total >= 1 ? 10 : 0;
  const evStatus = ev.total >= 3 ? 'good' : ev.total >= 1 ? 'warn' : 'crit';

  const score = clamp(directPts + blocksPts + parasPts + qPts + evPts);

  return {
    score,
    checks: [
      { name: t('answerability.direct.name'), status: directStatus,
        detail: t('answerability.direct.detail', { median: median === null ? '—' : median, sections: secs.length }),
        fix: directStatus === 'good' || directStatus === 'info' ? null : t('answerability.direct.fix') },
      { name: t('answerability.blocks.name'), status: blocksStatus,
        detail: t('answerability.blocks.detail', { blocks: blocks.total, words, lists: blocks.lists, tables: blocks.tables }),
        fix: blocksStatus === 'good' ? null : t('answerability.blocks.fix') },
      { name: t('answerability.paras.name'), status: parasStatus,
        detail: t('answerability.paras.detail', { long: paras.long, total: paras.total }),
        fix: parasStatus === 'good' ? null : t('answerability.paras.fix') },
      { name: t('answerability.questions.name'), status: qStatus,
        detail: t('answerability.questions.detail', { have: qHave, total: secs.length, lang: pLang }),
        fix: qStatus === 'good' || qStatus === 'info' ? null : t('answerability.questions.fix') },
      { name: t('answerability.evidence.name'), status: evStatus,
        detail: t('answerability.evidence.detail', { count: ev.total, numbers: ev.numbers, quotes: ev.quotes, links: ev.extLinks }),
        fix: evStatus === 'good' ? null : t('answerability.evidence.fix') },
    ],
  };
}

// ⑤ VISIBILITÀ OFF-SITE — CCBot ammesso + presenza in Common Crawl (best-effort).
export function analyzeOffsite({ ccbotAllowed, inCommonCrawl }, lang = 'it') {
  const t = makeT(lang);
  let score = ccbotAllowed ? 60 : 0;
  if (inCommonCrawl === true) score = 100;
  else if (inCommonCrawl === null && ccbotAllowed) score = 60; // CC non interrogabile: non penalizziamo oltre

  // Se CCBot è ammesso ma l'indice non risponde, di questo modulo non abbiamo
  // misurato niente: il solo segnale sotto il controllo del sito (CCBot) è a posto
  // e l'altro è ignoto. Misurato il 2026-07-31: il CDX rispondeva 504 dal proprio
  // nginx dopo 10s su due indici diversi, e il punteggio del sito scendeva da 100
  // a 60 senza che il sito fosse cambiato. Un modulo `unmeasured` esce dalla media
  // pesata: il voto deve dipendere dal sito, non dall'uptime di Common Crawl.
  const unmeasured = ccbotAllowed && inCommonCrawl === null;

  return {
    ...(unmeasured ? { unmeasured: true } : {}),
    score: clamp(score),
    checks: [
      { name: t('offsite.ccbot.name'), status: ccbotAllowed ? 'good' : 'crit',
        detail: ccbotAllowed ? t('offsite.ccbot.detail.ok') : t('offsite.ccbot.detail.blocked'),
        fix: !ccbotAllowed ? t('offsite.ccbot.fix') : null },
      { name: t('offsite.cc.name'), status: inCommonCrawl === true ? 'good' : 'info',
        detail: inCommonCrawl === true ? t('offsite.cc.detail.found') : inCommonCrawl === false ? t('offsite.cc.detail.notFound') : t('offsite.cc.detail.unavailable') },
    ],
  };
}

// Etichette categorie localizzate (per report/CLI); CATEGORY_LABELS resta la
// costante italiana storica, ora derivata dal catalogo (retro-compatibile).
export function categoryLabels(lang = 'it') {
  const t = makeT(lang);
  return {
    access: t('category.access'), agentFiles: t('category.agentFiles'), structured: t('category.structured'),
    readability: t('category.readability'), offsite: t('category.offsite'),
  };
}
export const CATEGORY_LABELS = categoryLabels('it');

// ⑥ SEGNALI E DIRITTI AI — informativo (NON pesato): cosa il sito dichiara alle AI su uso/licenze.
// TDMRep (.well-known/tdmrep.json), RSL / rel="license", Content-Signal (robots/header).
export function analyzeRights({ tdmrep, license, contentSignal }, lang = 'it') {
  const t = makeT(lang);
  const present = [tdmrep, license, contentSignal].filter(Boolean).length;
  return {
    informational: true,
    score: clamp(pct(present, 3)),
    checks: [
      { name: t('rights.tdmrep.name'), status: tdmrep ? 'good' : 'info',
        detail: tdmrep ? t('rights.tdmrep.detail.ok') : t('rights.tdmrep.detail.none'),
        fix: tdmrep ? null : t('rights.tdmrep.fix') },
      { name: t('rights.license.name'), status: license ? 'good' : 'info',
        detail: license ? t('rights.license.detail.ok') : t('rights.license.detail.none') },
      { name: t('rights.signal.name'), status: contentSignal ? 'good' : 'info',
        detail: contentSignal ? t('rights.signal.detail.ok') : t('rights.signal.detail.none'),
        fix: contentSignal ? null : t('rights.signal.fix') },
    ],
  };
}
export const RIGHTS_LABEL = 'Segnali e diritti AI';

// ⑦ FONDAMENTALI TECNICI — informativo ma con allarmi forti (noindex/HTTPS bloccano la visibilità).
export function analyzeTech({ https, noindex, viewport, statusOk }, lang = 'it') {
  const t = makeT(lang);
  const checks = [
    { name: t('tech.https.name'), status: https ? 'good' : 'crit',
      detail: https ? t('tech.https.detail.ok') : t('tech.https.detail.no'),
      fix: https ? null : t('tech.https.fix') },
    { name: t('tech.noindex.name'), status: noindex ? 'crit' : 'good',
      detail: noindex ? t('tech.noindex.detail.no') : t('tech.noindex.detail.ok'),
      fix: noindex ? t('tech.noindex.fix') : null },
    { name: t('tech.viewport.name'), status: viewport ? 'good' : 'warn',
      detail: viewport ? t('tech.viewport.detail.ok') : t('tech.viewport.detail.no'),
      fix: viewport ? null : t('tech.viewport.fix') },
    { name: t('tech.status.name'), status: statusOk ? 'good' : 'crit',
      detail: statusOk ? t('tech.status.detail.ok') : t('tech.status.detail.no') },
  ];
  const good = checks.filter((c) => c.status === 'good').length;
  return { informational: true, score: clamp(pct(good, 4)), checks };
}
export const TECH_LABEL = 'Fondamentali tecnici';

// src/messages/index.js — catalogo messaggi del MOTORE (i18n lato server).
// Chiavi STABILI con template parametrici {nome}; italiano = lingua base e fallback.
// Le funzioni del motore ricevono `lang` (default 'it') e leggono da qui: la CLI
// e i test restano invariati. I dizionari sono un file per lingua (come
// web/app/translations/), così i traduttori lavorano su un file solo.
import { it } from './it.js';
import { en } from './en.js';
import { de } from './de.js';
import { fr } from './fr.js';
import { es } from './es.js';
import { pt } from './pt.js';

export const ENGINE_LANGS = ['it', 'en', 'de', 'fr', 'es', 'pt'];
const DICTS = { it, en, de, fr, es, pt };

// Whitelist: qualunque valore fuori lista (o assente) ricade su 'it'.
export function normalizeLang(lang) {
  return ENGINE_LANGS.includes(lang) ? lang : 'it';
}

// Interpola i segnaposto {nome} nel template (i segnaposto ignoti restano visibili).
function fill(tpl, params) {
  if (!params) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (m, k) => (params[k] == null ? m : String(params[k])));
}

// Messaggio tradotto: valore mancante o vuoto nel dizionario → fallback italiano.
export function msg(lang, key, params) {
  const l = normalizeLang(lang);
  const dict = DICTS[l] || it;
  const raw = dict[key];
  const tpl = (typeof raw === 'string' && raw !== '') ? raw : (it[key] ?? key);
  return fill(tpl, params);
}

// Testo utente per un errore del motore. Gli errori "di input" (normUrl, guard
// anti-SSRF) portano `code` = chiave di questo catalogo e `detail` = il dato che
// li ha causati; `message` invece è italiano per costruzione, perché serve ai log
// e alla CLI. Le route chiamano questa funzione invece di rigirare `e.message`,
// altrimenti una pagina inglese mostra un errore italiano.
export function errorText(lang, e) {
  const code = e && e.code;
  if (code && (it[code] || DICTS[normalizeLang(lang)]?.[code])) {
    return msg(lang, code, { detail: e.detail });
  }
  // Errore senza code = imprevisto (bug, errore di rete di Node). Qui si
  // restituisce stringa VUOTA e chi chiama mette un generico tradotto: il
  // `message` originale NON va all'utente. Non è pudore, è che quel testo lo
  // scrive Node e nomina l'infrastruttura — «connect ECONNREFUSED 10.0.0.5:443»,
  // path assoluti, nomi di host interni — e finisce in una risposta HTTP
  // pubblica. Chi legge non può farne nulla, chi sonda il server sì. Il testo
  // completo resta nei log del server, dove serve a noi.
  return '';
}

// Factory: t(key, params) legata a una lingua — comoda dentro gli analyzer.
export function makeT(lang) {
  return (key, params) => msg(lang, key, params);
}

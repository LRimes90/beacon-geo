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

// Factory: t(key, params) legata a una lingua — comoda dentro gli analyzer.
export function makeT(lang) {
  return (key, params) => msg(lang, key, params);
}

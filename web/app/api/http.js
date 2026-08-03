// app/api/http.js — risposte di errore comuni alle route.
// NON è una route: dentro `app/` solo i file chiamati `route.js` lo sono.
//
// Esisteva lo stesso blocco copiato in cinque endpoint, con i messaggi scritti a
// mano in italiano: le pagine erano tradotte in sei lingue e gli errori no.
// Qui i messaggi passano tutti dal catalogo del motore, e il testo originale di
// un'eccezione imprevista finisce nei log del server invece che nella risposta.
import { msg, normalizeLang, errorText } from 'beacon-geo/messages';

// La lingua serve anche PRIMA di leggere il body: se il JSON è malformato non
// esiste `body.lang`, e senza ripiego un client inglese riceverebbe italiano.
// Ordine: `?lang=` in query → `Accept-Language` → italiano (whitelist a valle).
export function reqLang(req, body) {
  if (body && body.lang) return normalizeLang(body.lang);
  let q = null;
  try { q = new URL(req.url).searchParams.get('lang'); } catch {}
  return normalizeLang(q || (req.headers.get('accept-language') || '').slice(0, 2).toLowerCase());
}

// Errore tradotto, con lo status esplicito: nessuna route deve più scrivere testo.
export function fail(lang, key, status, params) {
  return Response.json({ error: msg(lang, key, params) }, { status });
}

// Eccezione → risposta. Un indirizzo scritto male o un blocco anti-SSRF sono
// colpa dell'input (400) e hanno un `code` traducibile; tutto il resto è un
// imprevisto (500) e l'utente riceve un generico, mentre il testo vero va nei
// log — è lì che serve, e nomina IP e path che non devono uscire in HTTP.
export function failFromError(lang, e, where) {
  const traducibile = errorText(lang, e);
  if (e && (e.badUrl || e.name === 'SsrfError')) {
    return Response.json({ error: traducibile || msg(lang, 'url.invalid', { detail: '' }) }, { status: 400 });
  }
  console.error('[' + where + ']', e);
  return fail(lang, 'api.failed', 500);
}

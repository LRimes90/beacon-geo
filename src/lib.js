// src/lib.js — rete + parsing HTML (regex-based, MVP senza dipendenze).
// ponytail: regex invece di cheerio/jsdom — sufficiente per i check dell'MVP;
// ponytail: upgrade a un parser DOM se i check diventano più fini (es. nesting semantico).
import { safeFetch, readCapped } from './ssrf-guard.js';

export const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

// User-agent AI da controllare nel robots.txt (parsing, 0 richieste extra).
export const AI_CRAWLERS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'anthropic-ai',
  'Google-Extended', 'Googlebot', 'PerplexityBot', 'Bingbot', 'Applebot', 'Amazonbot',
  'Meta-ExternalAgent', 'CCBot', 'Bytespider', 'cohere-ai', 'DuckAssistBot', 'YouBot', 'MistralAI-User'
];
// Sottoinsieme per il fetch live (impersonazione reale — teniamolo piccolo per non essere invasivi).
export const LIVE_UA = ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Googlebot', 'CCBot'];

// Normalizza l'indirizzo digitato dall'utente: aggiunge lo schema se manca e
// controlla che sia parsabile. Prima questa logica era ripetuta in quattro
// orchestratori e `new URL` lanciava un `TypeError: Invalid URL` che le route
// mostravano come «Analisi fallita: TypeError» con stato 500: un indirizzo
// scritto male è colpa dell'input, non del server, e deve dare 400 con un
// messaggio leggibile. `badUrl` è il flag che le route usano per distinguerlo.
export function normUrl(raw) {
  // Come SsrfError: il messaggio resta in italiano (CLI e log), il `code` serve
  // alle route per ridirlo nella lingua dell'utente.
  const fail = (msg, code, detail) => {
    const e = new Error(msg);
    e.badUrl = true;
    e.code = code;
    if (detail !== undefined) e.detail = detail;
    throw e;
  };
  // typeof prima di tutto: il body è JSON, un numero o un oggetto arrivano qui
  // senza sforzo. Con `String(42)` diventava `https://42/` — un host che nessun
  // DNS risolve, quindi un errore di rete al posto di un errore di input.
  if (typeof raw !== 'string') fail('Indirizzo del sito mancante', 'url.missing');
  const typed = raw.trim();
  if (!typed) fail('Indirizzo del sito mancante', 'url.missing');
  // Lo schema va riconosciuto PRIMA di aggiungere `https://`: senza questo,
  // `file:///etc/passwd` diventava `https://file:///etc/passwd` e veniva
  // respinto con «senza nome di dominio» — vero ma incomprensibile.
  // Il punto e le cifre distinguono uno schema da un host con la porta:
  // `esempio.ch:8080` non è lo schema «esempio.ch», è un indirizzo legittimo.
  const m = /^([a-z][a-z0-9+.-]*):(\/\/)?(\d*)/i.exec(typed);
  const isScheme = m && !m[1].includes('.') && (m[2] || !m[3]);
  if (isScheme && !/^https?$/i.test(m[1])) fail('Sono ammessi solo indirizzi http e https', 'url.scheme');
  let u;
  try { u = new URL(/^https?:\/\//i.test(typed) ? typed : 'https://' + typed); }
  catch { fail('Indirizzo del sito non valido: ' + typed.slice(0, 80), 'url.invalid', typed.slice(0, 80)); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') fail('Sono ammessi solo indirizzi http e https', 'url.scheme');
  if (!u.hostname) fail('Indirizzo senza nome di dominio: ' + typed.slice(0, 80), 'url.noDomain', typed.slice(0, 80));
  // Un host senza punto non è un sito pubblico: `42`, `localhost`, `intranet`.
  // Gli IP letterali (v4 puntati, v6 fra parentesi) e i nomi interni li ferma
  // già il guard SSRF; qui si scarta prima ciò che non è nemmeno un dominio.
  if (!u.hostname.includes('.') && !u.hostname.startsWith('[')) {
    fail('Indirizzo senza nome di dominio: ' + typed.slice(0, 80), 'url.noDomain', typed.slice(0, 80));
  }
  return u.href;
}

export async function fetchText(url, { ua = BROWSER_UA, timeout = 15000, retries = 2 } = {}) {
  let last = { ok: false, status: 0, body: '', error: 'no attempt' };
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      // safeFetch valida l'host (anti-SSRF) a ogni redirect; readCapped limita i byte.
      const { res, finalUrl } = await safeFetch(url, { headers: { 'User-Agent': ua, Accept: 'text/html,application/xhtml+xml,*/*' }, signal: ctrl.signal });
      const body = await readCapped(res);
      clearTimeout(timer);
      // `headers` è l'oggetto Headers nativo: serve ad AIPREF (Content-Usage) e non
      // finisce nel JSON del report (Headers non è serializzabile).
      return { ok: res.ok, status: res.status, body, finalUrl, headers: res.headers };
    } catch (e) {
      clearTimeout(timer);
      last = { ok: false, status: 0, body: '', error: String((e && e.message) || e) };
      // Un blocco anti-SSRF è una decisione, non un guasto passeggero: riprovare
      // dà tre volte lo stesso esito. Su una scansione con molte sotto-richieste
      // il backoff inutile portava l'audit oltre i 20s (tetto in produzione: 30).
      // `blocked` distingue «indirizzo rifiutato» (colpa di ciò che è stato
      // scritto) da «sito che non risponde»: chi chiama sceglie 400 o 424.
      // `code`/`detail` viaggiano insieme a `blocked`: il messaggio in `error` è
      // italiano (serve ai log e alla CLI), il code permette a chi risponde
      // all'utente di tradurre il motivo nella lingua richiesta.
      if (e && e.name === 'SsrfError') {
        last.blocked = true;
        last.errorCode = e.code;
        last.errorDetail = e.detail;
        break;
      }
      if (attempt < retries) await new Promise((r) => setTimeout(r, 600 * (attempt + 1))); // backoff
    }
  }
  return last;
}

export async function head(url, { ua = BROWSER_UA, timeout = 8000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    // GET leggero (molti server non gestiscono bene HEAD); leggiamo solo lo status.
    // safeFetch applica la validazione anti-SSRF anche qui.
    const { res } = await safeFetch(url, { method: 'GET', headers: { 'User-Agent': ua }, signal: ctrl.signal });
    return { ok: res.ok, status: res.status };
  } catch { return { ok: false, status: 0 }; }
  finally { clearTimeout(timer); }
}

// ---------- HTML helpers (funzioni pure) ----------
export function getTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, ' ').trim() : null;
}
export function getMeta(html, name) {
  // Il delimitatore va catturato e richiuso con backreference: con [^"']* un apostrofo
  // dentro content troncava il valore (in italiano dell'/l'/un' sono ovunque) → description
  // "troppo corta" e structured penalizzato su tutti i siti italiani.
  const a = html.match(new RegExp('<meta[^>]+(?:name|property)=["\\\']' + name + '["\\\'][^>]*?content=(["\\\'])([\\s\\S]*?)\\1', 'i'));
  if (a) return a[2];
  const b = html.match(new RegExp('<meta[^>]+content=(["\\\'])([\\s\\S]*?)\\1[^>]*?(?:name|property)=["\\\']' + name + '["\\\']', 'i'));
  return b ? b[2] : null;
}
export function has(html, re) { return re.test(html); }
export function count(html, re) { const m = html.match(re); return m ? m.length : 0; }

export function jsonLdTypes(html) {
  const types = new Set();
  const re = /<script[^>]+type=["\']application\/ld\+json["\'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const data = JSON.parse(m[1].trim());
      const walk = (o) => {
        if (!o || typeof o !== 'object') return;
        if (o['@type']) [].concat(o['@type']).forEach((t) => types.add(String(t)));
        Object.values(o).forEach((v) => (Array.isArray(v) ? v.forEach(walk) : walk(v)));
      };
      walk(data);
    } catch { /* blocco JSON-LD non valido: ignorato */ }
  }
  return [...types];
}
export function jsonLdCount(html) {
  return count(html, /<script[^>]+type=["\']application\/ld\+json["\']/gi);
}
// Commenti, <style>, <script>, <template> e <noscript> contengono stringhe che *sembrano*
// tag ma non esistono nel DOM: un "<h1" dentro un commento CSS faceva contare 2 H1 su
// canmedticino.ch (falso positivo "H1 duplicato"). Da ripulire prima di ogni conteggio.
export function contentHtml(html) {
  return String(html || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<template\b[\s\S]*?<\/template>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ');
}

// Denominatore del rapporto semantico: solo il <body>. I tag di <head> (meta, link, title)
// non possono per definizione essere semantici e diluivano il rapporto verso il basso.
export function bodyHtml(html) {
  const clean = contentHtml(html);
  const m = clean.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  return m ? m[1] : clean;
}

export function semanticRatio(html) {
  const body = bodyHtml(html);
  const semantic = count(body, /<(header|nav|main|article|section|aside|footer|figure|figcaption|time|mark)\b/gi);
  const total = count(body, /<[a-z][a-z0-9]*\b/gi) || 1;
  return { semantic, total, ratio: semantic / total };
}
export function headings(html) {
  const clean = contentHtml(html);
  const h = {};
  for (let i = 1; i <= 6; i++) h['h' + i] = count(clean, new RegExp('<h' + i + '\\b', 'gi'));
  return h;
}
export function imgAlt(html) {
  const imgs = contentHtml(html).match(/<img\b[^>]*>/gi) || [];
  const withAlt = imgs.filter((i) => /\balt\s*=\s*["'][^"']*["']/i.test(i)).length;
  return { total: imgs.length, withAlt };
}
export function wordCount(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ');
  return (text.match(/[\p{L}\p{N}]{2,}/gu) || []).length;
}
export function links(html, host) {
  const hrefs = [...contentHtml(html).matchAll(/<a\b[^>]*href=["\']([^"\']+)["\']/gi)].map((m) => m[1]);
  let internal = 0, external = 0;
  for (const h of hrefs) {
    if (h.startsWith('#') || h.startsWith('mailto:') || h.startsWith('tel:') || h.startsWith('javascript:')) continue;
    if (/^https?:\/\//i.test(h)) (host && h.includes(host) ? internal++ : external++);
    else internal++;
  }
  return { internal, external, total: hrefs.length };
}

// ---------- answer-readiness (funzioni pure) ----------
// ponytail: regex, non un parser DOM — stessa scelta di semanticRatio/headings/imgAlt
// ponytail: e vincolo di progetto (zero dipendenze). HTML gravemente malformato (<p> mai
// ponytail: chiusi) degrada paragraphWords: la via d'uscita è un tokenizer minimale, non cheerio.

// Testo nudo: via i tag, le entità diventano spazio, gli spazi si collassano.
export function stripTags(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Lingua dichiarata dalla pagina. Serve al check dei titoli-domanda: le parole
// interrogative vanno cercate nella lingua del SITO, non in quella del report.
export function htmlLang(html) {
  const m = String(html || '').match(/<html[^>]*\slang=["']?([a-z]{2})/i);
  return m ? m[1].toLowerCase() : null;
}

// Conta le parole di un testo già nudo (stessa regola di wordCount, senza stripping).
const textWords = (s) => (String(s || '').match(/[\p{L}\p{N}]{2,}/gu) || []).length;

// Prima frase: fino al primo punto/!/? seguito da spazio o fine. Senza punteggiatura
// entro 600 caratteri si taglia lì: un muro di testo senza punti è già la risposta
// che il check vuole segnalare.
function firstSentence(text) {
  const s = String(text || '').trim();
  const m = s.match(/^[\s\S]{1,600}?[.!?](?:\s|$)/);
  return m ? m[0] : s.slice(0, 600);
}

// "Cornice" della pagina (menu, testata, piè di pagina): condivisa da sections,
// extractableBlocks, paragraphWords e citableEvidence, altrimenti un h3 di sidebar
// ("Iscriviti alla newsletter"), un menu di link o un numero di telefono in <header>
// si mischiano col contenuto reale — e ogni sito WordPress ha tutti e tre.
const stripChrome = (html) => html
  .replace(/<nav\b[\s\S]*?<\/nav>/gi, ' ')
  .replace(/<header\b[\s\S]*?<\/header>/gi, ' ')
  .replace(/<footer\b[\s\S]*?<\/footer>/gi, ' ');

// Parole del solo CONTENUTO (chrome escluso): wordCount(html) misura la pagina intera
// e resta così per readabilityMetrics; qui serve lo stesso numero che sections/
// extractableBlocks/paragraphWords/citableEvidence già usano, altrimenti il gate delle
// 300 parole e i denominatori vengono gonfiati da menu/testata/footer (round di review 1).
export function contentWords(html) {
  return wordCount(stripChrome(bodyHtml(html)));
}

// Una voce per ogni H2/H3, con la lunghezza in parole della prima frase del blocco
// di testo che lo segue. Il blocco è il primo <p> dopo l'heading; se non c'è <p>,
// è il testo nudo fino all'heading successivo.
export function sections(html) {
  const body = stripChrome(bodyHtml(html));
  const re = /<h([23])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  const found = [];
  let m;
  while ((m = re.exec(body))) found.push({ heading: stripTags(m[2]), from: re.lastIndex, level: m[1] });
  return found.map((s, i) => {
    const chunk = body.slice(s.from, i + 1 < found.length ? found[i + 1].from : body.length);
    const p = chunk.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
    const text = stripTags(p ? p[1] : chunk);
    return { heading: s.heading, level: s.level, firstSentenceWords: textWords(firstSentence(text)) };
  });
}

// Blocchi <ul>/<ol> di primo livello in `html`: un backreference su un nome di tag
// generico (\1) si ferma al primo tag di chiusura omonimo, che con una lista annidata
// è quello INTERNO, non quello che chiude la lista esterna ("<ul><li>passo<ul>...
// </ul></li></ul>" veniva letto come chiuso al primo </ul>). Qui si segue la
// profondità di apertura/chiusura invece del backreference.
function topLevelLists(html) {
  const re = /<(\/?)(ul|ol)\b[^>]*>/gi;
  const blocks = [];
  let depth = 0, from = -1, m;
  while ((m = re.exec(html))) {
    if (!m[1]) { if (depth === 0) from = re.lastIndex; depth++; }
    else if (depth > 0 && --depth === 0) blocks.push(html.slice(from, m.index));
  }
  return blocks;
}

// Rimuove le sotto-liste annidate dentro una lista di primo livello (stessa logica
// di profondità di topLevelLists, applicata al contenuto interno): senza questo, "passo
// uno" con una sotto-lista di 2 punti conterebbe 3 <li> invece di 1 voce di primo livello.
// ponytail: se non c'è spazio attorno al tag annidato nell'HTML sorgente, le due parole
// ai margini possono toccarsi senza spazio — caso raro, non coperto.
function stripNestedLists(html) {
  const re = /<(\/?)(ul|ol)\b[^>]*>/gi;
  let depth = 0, last = 0, out = '', m;
  while ((m = re.exec(html))) {
    if (!m[1]) { if (depth === 0) out += html.slice(last, m.index); depth++; }
    else if (depth > 0 && --depth === 0) last = re.lastIndex;
  }
  return out + html.slice(last);
}

// Blocchi che una AI può estrarre e citare: liste con almeno 3 voci e tabelle con
// intestazioni. Navigazione, header e footer sono esclusi: senza questo filtro ogni
// sito WordPress guadagnerebbe punti per il proprio menu. Esclusa anche la lista in
// cui oltre il 70% delle voci è praticamente solo un link (widget "articoli recenti").
export function extractableBlocks(html) {
  const body = stripChrome(bodyHtml(html));
  let lists = 0;
  for (const listInner of topLevelLists(body)) {
    const items = stripNestedLists(listInner).match(/<li\b[\s\S]*?<\/li>/gi) || [];
    if (items.length < 3) continue;
    const linkOnly = items.filter((li) => {
      const txt = stripTags(li);
      if (!txt) return true;
      const anchor = stripTags((li.match(/<a\b[\s\S]*?<\/a>/i) || [''])[0]);
      return anchor.length >= txt.length * 0.8;
    }).length;
    if (linkOnly / items.length > 0.7) continue;
    lists++;
  }
  const tables = [...body.matchAll(/<table\b[\s\S]*?<\/table>/gi)].filter((m) => /<th\b/i.test(m[0])).length;
  return { lists, tables, total: lists + tables };
}

// Distribuzione delle parole per paragrafo. I paragrafi sotto le 10 parole
// (didascalie, note, "Leggi anche") non sono prosa: fuori dal denominatore.
export function paragraphWords(html) {
  const words = (stripChrome(bodyHtml(html)).match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || [])
    .map((p) => textWords(stripTags(p)))
    .filter((n) => n >= 10);
  return { total: words.length, long: words.filter((n) => n > 120).length, words };
}

// Un numero come "1.500 CHF" matcha sia il pattern con unità sia quello delle migliaia:
// senza dedup viene contato 2 volte per lo stesso dato (round di review 1). Si fondono
// gli intervalli di match sovrapposti e si conta un gruppo fuso una volta sola.
function countNumberTokens(text) {
  const patterns = [
    /\d[\d.,]*\s?(?:%|€|\$|CHF|USD|EUR|km|kg|mq|m²|GB|MB|ms|s\b|min\b|ore|anni|giorni|volte|x\b)/gi,
    /\b(?:19|20)\d{2}\b/g,
    /\b\d{1,3}(?:[.\s]\d{3})+\b/g,
  ];
  const spans = [];
  for (const re of patterns) for (const m of text.matchAll(re)) spans.push([m.index, m.index + m[0].length]);
  spans.sort((a, b) => a[0] - b[0]);
  let groups = 0, curEnd = -1;
  for (const [start, end] of spans) {
    if (start >= curEnd) { groups++; curEnd = end; }
    else if (end > curEnd) { curEnd = end; }
  }
  return groups;
}

// Elementi che rendono un passaggio citabile: dati con unità di misura, anni,
// citazioni esplicite, link a fonti esterne dentro il testo (non nel menu/testata/footer).
export function citableEvidence(html, host) {
  const body = stripChrome(bodyHtml(html));
  const text = stripTags(body);
  const numbers = countNumberTokens(text);
  const quotes = count(body, /<blockquote\b/gi) + count(body, /<cite\b/gi);
  let extLinks = 0;
  for (const p of body.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || []) extLinks += links(p, host).external;
  return { numbers, quotes, extLinks, total: numbers + quotes + extLinks };
}

// ---------- robots.txt ----------
// Ritorna { isAllowed(ua, path), sitemaps, groups }. Longest-match per path (semplificato per MVP).
export function parseRobots(txt) {
  const groups = [];
  let cur = null;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const val = line.slice(idx + 1).trim();
    if (field === 'user-agent') {
      if (!cur || cur.rules.length) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(val.toLowerCase());
    } else if ((field === 'disallow' || field === 'allow') && cur) {
      cur.rules.push({ type: field, path: val });
    }
  }
  const matchGroup = (ua) => {
    ua = ua.toLowerCase();
    let star = null, exact = null;
    for (const g of groups) for (const a of g.agents) {
      if (a === '*') star = g;
      else if (ua.includes(a) || a.includes(ua)) exact = g;
    }
    return exact || star;
  };
  const isAllowed = (ua, path = '/') => {
    const g = matchGroup(ua);
    if (!g) return true;
    let allowed = true, best = -1;
    for (const r of g.rules) {
      if (r.path === '') continue; // "Disallow:" vuoto = nessun blocco
      const matches = r.path === '/' ? true : path.startsWith(r.path);
      if (matches && r.path.length >= best) { best = r.path.length; allowed = r.type === 'allow'; }
    }
    return allowed;
  };
  const sitemaps = [...txt.matchAll(/^sitemap:\s*(.+)$/gim)].map((m) => m[1].trim());
  return { isAllowed, sitemaps, groupCount: groups.length };
}

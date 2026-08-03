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
      return { ok: res.ok, status: res.status, body, finalUrl };
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

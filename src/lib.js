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
      last = { ok: false, status: 0, body: '', error: String(e) };
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
  const a = html.match(new RegExp('<meta[^>]+(?:name|property)=["\\\']' + name + '["\\\'][^>]*?content=["\\\']([^"\\\']*)["\\\']', 'i'));
  if (a) return a[1];
  const b = html.match(new RegExp('<meta[^>]+content=["\\\']([^"\\\']*)["\\\'][^>]*?(?:name|property)=["\\\']' + name + '["\\\']', 'i'));
  return b ? b[1] : null;
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
export function semanticRatio(html) {
  const semantic = count(html, /<(header|nav|main|article|section|aside|footer|figure|figcaption|time|mark)\b/gi);
  const total = count(html, /<[a-z][a-z0-9]*\b/gi) || 1;
  return { semantic, total, ratio: semantic / total };
}
export function headings(html) {
  const h = {};
  for (let i = 1; i <= 6; i++) h['h' + i] = count(html, new RegExp('<h' + i + '\\b', 'gi'));
  return h;
}
export function imgAlt(html) {
  const imgs = html.match(/<img\b[^>]*>/gi) || [];
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
  const hrefs = [...html.matchAll(/<a\b[^>]*href=["\']([^"\']+)["\']/gi)].map((m) => m[1]);
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

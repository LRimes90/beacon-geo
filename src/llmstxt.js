// src/llmstxt.js — GENERATORE di llms.txt (differenziatore vs Pharos).
// Deriva un llms.txt conforme alla spec (https://llmstxt.org) dai contenuti reali della pagina.
import { getTitle, getMeta } from './lib.js';

// Deriva il nome del brand: og:site_name → application-name → title ripulito → dominio.
export function deriveBrand(html, host) {
  const og = (getMeta(html, 'og:site_name') || getMeta(html, 'application-name') || '').trim();
  if (og) return og;
  const raw = (getTitle(html) || '').trim();
  const parts = raw.split(/\s*[|·–—\-:]\s*/).map((s) => s.trim()).filter(Boolean);
  const generic = /^(home|homepage|home ?page|benvenut[oi]|welcome|start|index)$/i;
  const named = parts.filter((p) => !generic.test(p));
  if (named.length) return named.sort((a, b) => b.length - a.length)[0]; // il segmento più descrittivo
  // fallback: dominio senza www/TLD, capitalizzato
  return (host || '').replace(/^www\./, '').split('.')[0].replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Estrae i link interni significativi (testo + href assoluto), deduplicati.
export function significantLinks(html, origin, max = 40) {
  const out = [];
  const seen = new Set();
  for (const m of html.matchAll(/<a\b[^>]*href=["\']([^"\']+)["\'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let href = m[1];
    const text = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text || text.length < 3) continue;
    if (/^(#|mailto:|tel:|javascript:)/i.test(href)) continue;
    try { href = new URL(href, origin).href.split('#')[0]; } catch { continue; }
    if (!href.startsWith(origin)) continue;
    // /contatti e /contatti/ sono la stessa pagina: dedup sulla forma senza slash finale
    const key = href.replace(/\/+$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ text, href });
    if (out.length >= max) break;
  }
  return out;
}

// Raggruppa i link per prima sezione di path: /progetti/x → "progetti"; top-level → "".
export function groupBySection(links, origin) {
  const groups = {};
  for (const l of links) {
    let seg = '';
    try { seg = new URL(l.href).pathname.replace(/^\/|\/$/g, '').split('/')[0] || ''; } catch { /* skip */ }
    (groups[seg] ||= []).push(l);
  }
  return groups;
}
const titleCase = (s) => s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// L'llms.txt è testo semplice, non HTML: le entità vanno risolte o si legge "L&#039;associazione".
export function decodeEntities(s) {
  return String(s || '')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (_, n) => ({
      amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
      laquo: '«', raquo: '»', hellip: '…', ndash: '–', mdash: '—',
      lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', bull: '•', middot: '·',
      egrave: 'è', eacute: 'é', agrave: 'à', igrave: 'ì', ograve: 'ò', ugrave: 'ù',
      euro: '€', deg: '°', copy: '©', reg: '®', trade: '™', rarr: '→', larr: '←',
    })[n.toLowerCase()] || _); // entità sconosciuta: lasciata invariata, meglio del testo mangiato
}

// Le card dei loop (Elementor, WP) infilano titolo + estratto + CTA dentro un solo <a>:
// nell'llms.txt serve un'etichetta, non l'articolo. Via la CTA, poi taglio a 90 su parola.
export function linkLabel(text) {
  let t = decodeEntities(text)
    .replace(/\s*(leggi (la storia|tutto|di più|l'articolo)|scopri di più|continua a leggere)\s*[»→>]*\s*$/i, '')
    .replace(/\s+/g, ' ').trim();
  if (t.length > 90) t = t.slice(0, 90).replace(/\s+\S*$/, '') + '…';
  return t;
}

export function generateLlmsTxt(html, url) {
  const origin = new URL(url).origin;
  const host = new URL(url).host;
  const brand = decodeEntities(deriveBrand(html, host)).trim();
  const desc = decodeEntities(getMeta(html, 'description') || getMeta(html, 'og:description') || '').trim();
  const links = significantLinks(html, origin)
    .map((l) => ({ ...l, text: linkLabel(l.text) }))
    // asset e endpoint non sono pagine: in un llms.txt sono rumore (es. "## Wp Content")
    .filter((l) => !/\/(wp-content|wp-json|wp-admin|wp-includes|feed|cdn-cgi)(\/|$)/i.test(new URL(l.href).pathname));
  const groups = groupBySection(links, origin);

  let out = `# ${brand}\n\n`;
  if (desc) out += `> ${desc}\n\n`;
  out += `Sito: ${origin}\n\n`;

  // Su un sito piatto (WP tipico) quasi ogni pagina è una sezione da sola: se le
  // scartassimo l'llms.txt resterebbe vuoto. Le sezioni con 1 sola pagina finiscono
  // in "Pagine principali" insieme ai link top-level.
  const top = [...(groups[''] || []), ...Object.entries(groups).filter(([s, l]) => s !== '' && l.length === 1).flatMap(([, l]) => l)];
  if (top.length) {
    out += `## Pagine principali\n\n`;
    for (const l of top.slice(0, 20)) out += `- [${l.text}](${l.href})\n`;
    out += `\n`;
  }
  for (const [seg, list] of Object.entries(groups)) {
    if (seg === '' || list.length < 2) continue;
    out += `## ${titleCase(seg)}\n\n`;
    for (const l of list.slice(0, 15)) out += `- [${l.text}](${l.href})\n`;
    out += `\n`;
  }

  out += `## Note\n\n`;
  out += `- File generato automaticamente da Beacon. Rivedi titoli e descrizioni prima di pubblicare.\n`;
  out += `- Posiziona questo file in ${origin}/llms.txt\n`;
  return out;
}

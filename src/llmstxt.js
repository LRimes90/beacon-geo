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
    if (seen.has(href)) continue;
    seen.add(href);
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

export function generateLlmsTxt(html, url) {
  const origin = new URL(url).origin;
  const host = new URL(url).host;
  const brand = deriveBrand(html, host);
  const desc = (getMeta(html, 'description') || getMeta(html, 'og:description') || '').trim();
  const groups = groupBySection(significantLinks(html, origin), origin);

  let out = `# ${brand}\n\n`;
  if (desc) out += `> ${desc}\n\n`;
  out += `Sito: ${origin}\n\n`;

  // top-level (sezione "") come "Pagine principali", poi le altre sezioni con ≥2 pagine
  const top = groups[''] || [];
  if (top.length) {
    out += `## Pagine principali\n\n`;
    for (const l of top.slice(0, 12)) out += `- [${l.text}](${l.href})\n`;
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

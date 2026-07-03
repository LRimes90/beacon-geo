// batch.js — analizza molti siti in parallelo (niente rate-limit: è il nostro motore).
// node batch.js            → usa la lista di default
// node batch.js a.com b.io  → analizza gli URL passati
// Concorrenza bassa + secondo giro sui falliti + marcatura esplicita dei fetch non riusciti.
import { audit } from './audit.js';
import { writeFile } from 'node:fs/promises';

const DEFAULT = [
  'stripe.com','wikipedia.org','info.cern.ch','google.com','apple.com','microsoft.com','meta.com','amazon.com','netflix.com',
  'openai.com','anthropic.com','perplexity.ai','huggingface.co','mistral.ai',
  'github.com','stackoverflow.com','developer.mozilla.org','react.dev','tailwindcss.com',
  'notion.so','figma.com','linear.app','vercel.com','slack.com',
  'amazon.it','zalando.it','ebay.com','etsy.com','shopify.com',
  'nytimes.com','bbc.com','theguardian.com','corriere.it','repubblica.it','ilpost.it',
  'britannica.com','mit.edu','nasa.gov',
  'gov.uk','europa.eu','agenziaentrate.gov.it',
  'berkshirehathaway.com','craigslist.org','motherfuckingwebsite.com','spacejam.com',
  'reddit.com','x.com','pinterest.com','linkedin.com',
  'poste.it','subito.it','verso.solutions',
];

const sites = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT;

// Un risultato è AFFIDABILE solo se la pagina è stata scaricata e ha contenuto reale.
function toRecord(url, r) {
  const c = r.categories;
  const reliable = r.fetchedOk && r.htmlLen >= 500;
  return { url, reliable, overall: r.overall, acc: c.access.score, fil: c.agentFiles.score, seo: c.structured.score, rd: c.readability.score, off: c.offsite.score };
}

async function runPool(list, conc) {
  const out = new Map();
  let i = 0, done = 0;
  async function worker() {
    while (i < list.length) {
      const url = list[i++];
      try {
        const r = await audit(url);
        out.set(url, toRecord(url, { ...r, htmlLen: (r.html || '').length }));
      } catch (e) { out.set(url, { url, reliable: false, error: String(e).slice(0, 50) }); }
      process.stderr.write(`\r${++done}/${list.length}   `);
    }
  }
  await Promise.all(Array.from({ length: conc }, worker));
  return out;
}

// Giro 1 (conc 5)
process.stderr.write('Giro 1...\n');
const map = await runPool(sites, 5);
// Giro 2 sui non affidabili (conc 2, più gentile)
const failed = sites.filter((u) => !map.get(u)?.reliable);
if (failed.length) {
  process.stderr.write(`\nGiro 2 (retry ${failed.length} falliti)...\n`);
  const retry = await runPool(failed, 2);
  for (const [u, r] of retry) if (r.reliable) map.set(u, r);
}
process.stderr.write('\n\n');

const all = sites.map((u) => map.get(u));
const ok = all.filter((r) => r && r.reliable).sort((a, b) => b.overall - a.overall);
const bad = all.filter((r) => r && !r.reliable);

const pad = (s, n) => String(s).padEnd(n);
const lp = (s, n) => String(s).padStart(n);
console.log(pad('#', 3) + pad('Sito', 26) + lp('Tot', 4) + lp('Acc', 5) + lp('File', 5) + lp('SEO', 5) + lp('Legg', 5) + lp('Off', 5));
console.log('─'.repeat(58));
ok.forEach((r, n) => console.log(pad(n + 1, 3) + pad(r.url, 26) + lp(r.overall, 4) + lp(r.acc, 5) + lp(r.fil, 5) + lp(r.seo, 5) + lp(r.rd, 5) + lp(r.off, 5)));

const avg = (k) => (ok.length ? Math.round(ok.reduce((s, r) => s + r[k], 0) / ok.length) : 0);
console.log(`\n✓ ${ok.length} siti affidabili — medie: Tot ${avg('overall')} · Acc ${avg('acc')} · File ${avg('fil')} · SEO ${avg('seo')} · Legg ${avg('rd')} · Off ${avg('off')}`);
if (bad.length) console.log(`⚠ ${bad.length} fetch non riusciti (esclusi): ${bad.map((b) => b.url).join(', ')}`);

await writeFile(new URL('./beacon-results.json', import.meta.url), JSON.stringify({ ok, bad }, null, 2));
console.log(`\n✓ salvati in beacon-results.json`);

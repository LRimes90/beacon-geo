// compare.js — CLI confronto competitor.
//   node compare.js tuosito.com concorrente1.com concorrente2.com
// Il PRIMO URL è il sito di riferimento; gli altri sono i concorrenti.
// Stampa il confronto in Markdown su stdout e salva un report HTML brandizzato.
import { compareAll } from './src/compare.js';
import { toHtmlCompare, toMarkdownCompare } from './src/compareReport.js';
import { writeFile } from 'node:fs/promises';

const urls = process.argv.slice(2);
if (urls.length < 2) {
  console.error('Uso: node compare.js <tuo-sito> <concorrente1> [concorrente2 ...]');
  process.exit(1);
}

process.stderr.write(`Confronto ${urls.length} siti (rif: ${urls[0]})...\n`);
const suites = await compareAll(urls, { conc: 3, psiKey: process.env.PAGESPEED_KEY });

console.log(toMarkdownCompare(suites));
await writeFile(new URL('./beacon-compare.html', import.meta.url), toHtmlCompare(suites));
process.stderr.write('\n✓ report HTML: beacon-compare.html\n');

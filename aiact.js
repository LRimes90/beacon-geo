// aiact.js — CLI del controllo AI Act.
//   node aiact.js <url> [--json] [--lang it|en|de|fr|es|pt]
// Scansiona i segnali di trasparenza AI Act presenti nella pagina.
// L'autovalutazione completa (ruolo, classe di rischio, casi d'uso) richiede le
// risposte di una persona: sta sul web (/aiact) o si usa assessAiAct() da codice.
import { auditAiAct } from './src/aiact.js';
import { normalizeLang } from './src/messages/index.js';

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--'));
if (!url) {
  console.error('Uso: node aiact.js <url> [--json] [--lang it|en]');
  process.exit(1);
}
const langArg = args.find((a) => a.startsWith('--lang='));
const lang = normalizeLang(langArg ? langArg.split('=')[1] : 'it');

const r = await auditAiAct(url, { lang });

if (args.includes('--json')) {
  console.log(JSON.stringify(r, null, 2));
} else if (!r.result) {
  console.error(`✗ ${r.url}: pagina non raggiungibile`);
  process.exit(2);
} else {
  const ICON = { good: '✓', warn: '!', crit: '✗', info: '·' };
  console.log(`\n🔦 Trasparenza AI Act — ${r.host}`);
  console.log(r.result.score === null
    ? 'Segnali di trasparenza rilevabili: n/d (troppo pochi controlli valutabili)\n'
    : `Segnali di trasparenza rilevabili: ${r.result.score}/100\n`);
  for (const c of r.result.checks) {
    console.log(`${ICON[c.status] || '·'} ${c.name} [${c.ref}]`);
    console.log(`   ${c.detail}`);
    if (c.fix) console.log(`   → ${c.fix}`);
  }
  console.log(`\n${r.result.disclaimer}`);
  console.log('Autovalutazione completa (ruolo, rischio, casi d’uso): /aiact sul web.\n');
}

// tune.js — tara i pesi di weights.json contro i punteggi REALI di Pharos.
// Dati: 8 siti con breakdown per categoria + totale, misurati dal vivo su pharos.verso.solutions.
// Metodo: coordinate descent vincolato (pesi >=0, somma=1) che minimizza l'RMSE tra
// il punteggio ricostruito (Σ cat*peso) e il totale di Pharos.
import { readFile, writeFile } from 'node:fs/promises';

const KEYS = ['access', 'agentFiles', 'structured', 'readability', 'offsite'];
// [access, agentFiles, structured, readability, offsite] , totale Pharos
const DATA = [
  { s: 'stripe.com',    c: [100, 60, 87, 70, 100], t: 83 },
  { s: 'wikipedia.org', c: [87, 20, 47, 80, 100], t: 67 },
  { s: 'google.com',    c: [100, 60, 47, 40, 100], t: 66 },
  { s: 'apple.com',     c: [100, 60, 87, 80, 100], t: 86 },
  { s: 'microsoft.com', c: [87, 60, 87, 80, 100], t: 83 },
  { s: 'meta.com',      c: [100, 20, 73, 50, 100], t: 69 },
  { s: 'amazon.com',    c: [33, 20, 33, 40, 20], t: 32 },
  { s: 'netflix.com',   c: [60, 100, 73, 60, 20], t: 65 },
];

const predict = (c, w) => c.reduce((s, v, i) => s + v * w[i], 0);
const rmse = (w) => Math.sqrt(DATA.reduce((s, d) => s + (predict(d.c, w) - d.t) ** 2, 0) / DATA.length);

function optimize(start) {
  let w = start.slice(), best = rmse(w);
  for (let step = 0.05; step >= 0.0025; step /= 2) {
    let improved = true;
    while (improved) {
      improved = false;
      for (let j = 0; j < 5; j++) for (let k = 0; k < 5; k++) {
        if (j === k || w[j] - step < 0) continue;
        const nw = w.slice(); nw[j] -= step; nw[k] += step;
        const e = rmse(nw);
        if (e < best - 1e-9) { w = nw; best = e; improved = true; }
      }
    }
  }
  return { w, err: best };
}

const current = [0.25, 0.15, 0.20, 0.25, 0.15];
const equal = [0.2, 0.2, 0.2, 0.2, 0.2];
const tuned = optimize(equal);

const fmt = (w) => KEYS.map((k, i) => `${k} ${w[i].toFixed(3)}`).join('  ');
console.log('Dataset: ' + DATA.length + ' siti Pharos (breakdown reale)\n');
console.log('Pesi ATTUALI   RMSE ' + rmse(current).toFixed(2) + '  |  ' + fmt(current));
console.log('Pesi UGUALI    RMSE ' + rmse(equal).toFixed(2) + '  |  ' + fmt(equal));
console.log('Pesi TARATI    RMSE ' + tuned.err.toFixed(2) + '  |  ' + fmt(tuned.w));
console.log('\nErrore per sito coi pesi tarati:');
for (const d of DATA) console.log('  ' + d.s.padEnd(16) + 'Beacon ' + Math.round(predict(d.c, tuned.w)) + '  vs Pharos ' + d.t + '  (Δ ' + (predict(d.c, tuned.w) - d.t >= 0 ? '+' : '') + (predict(d.c, tuned.w) - d.t).toFixed(1) + ')');

// scrive i pesi tarati (arrotondati a 2 decimali, ri-normalizzati a somma 1) in weights.json se --write
if (process.argv.includes('--write')) {
  let r = tuned.w.map((x) => Math.round(x * 100) / 100);
  const sum = r.reduce((a, b) => a + b, 0);
  r = r.map((x) => Math.round((x / sum) * 100) / 100);
  const obj = JSON.parse(await readFile(new URL('./weights.json', import.meta.url), 'utf8'));
  KEYS.forEach((k, i) => { obj[k] = r[i]; });
  obj._comment = 'Pesi tarati su 8 siti Pharos reali via tune.js (coordinate descent, RMSE ' + tuned.err.toFixed(2) + '). Rilancia: node tune.js --write';
  await writeFile(new URL('./weights.json', import.meta.url), JSON.stringify(obj, null, 2) + '\n');
  console.log('\n✓ weights.json aggiornato: ' + fmt(r));
}

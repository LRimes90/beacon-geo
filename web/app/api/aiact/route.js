// app/api/aiact/route.js — endpoint del modulo AI Act (companion, come a11y e perf).
// Due modalità nello stesso endpoint:
//   { url }            → scansione dei segnali in pagina
//   { url, answers }   → scansione + autovalutazione (il questionario usa i segnali)
//   { answers }        → sola autovalutazione, senza rete
// Nessuna logica qui: tutto nel motore (src/aiact.js, src/aiactAssess.js).
import { auditAiAct } from 'beacon-geo/aiact';
import { assessAiAct } from 'beacon-geo/aiact-assess';
import { guard } from 'beacon-geo/guard';
import { normalizeLang } from 'beacon-geo/messages';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON non valido' }, { status: 400 }); }
  const { url, answers, lang } = body || {};
  if (!url && !answers) return Response.json({ error: 'Serve un indirizzo del sito o le risposte del questionario' }, { status: 400 });
  if (url && typeof url !== 'string') return Response.json({ error: 'Indirizzo del sito non valido' }, { status: 400 });
  if (answers && (typeof answers !== 'object' || Array.isArray(answers))) {
    return Response.json({ error: 'Risposte non valide' }, { status: 400 });
  }

  // La sola autovalutazione non fa richieste di rete → non consuma quota.
  if (url) { const blocked = await guard(req, body); if (blocked) return blocked; }

  const l = normalizeLang(lang);
  try {
    const scan = url ? await auditAiAct(url, { lang: l }) : null;
    const signals = scan && scan.result ? scan.result.signals : null;
    const assessment = answers ? assessAiAct(answers, signals, l) : null;
    return Response.json({ scan, assessment });
  } catch (e) {
    return Response.json({ error: 'Analisi fallita: ' + String(e).slice(0, 120) }, { status: 500 });
  }
}

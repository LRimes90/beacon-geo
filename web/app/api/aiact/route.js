// app/api/aiact/route.js — endpoint del modulo AI Act (companion, come a11y e perf).
// Due modalità nello stesso endpoint:
//   { url }            → scansione dei segnali in pagina
//   { url, answers }   → scansione + autovalutazione (il questionario usa i segnali)
//   { answers }        → sola autovalutazione, senza rete
// Nessuna logica qui: tutto nel motore (src/aiact.js, src/aiactAssess.js).
import { auditAiAct } from 'beacon-geo/aiact';
import { assessAiAct } from 'beacon-geo/aiact-assess';
import { guard } from 'beacon-geo/guard';
import { msg } from 'beacon-geo/messages';
import { reqLang, fail, failFromError } from '../http.js';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return fail(reqLang(req), 'api.badJson', 400); }
  const { url, answers } = body || {};
  const l = reqLang(req, body);
  if (!url && !answers) return fail(l, 'api.needUrlOrAnswers', 400);
  if (url && typeof url !== 'string') return fail(l, 'url.notString', 400);
  if (answers && (typeof answers !== 'object' || Array.isArray(answers))) {
    return fail(l, 'api.answersInvalid', 400);
  }

  // La sola autovalutazione non fa richieste di rete → non consuma quota.
  if (url) { const blocked = await guard(req, body); if (blocked) return blocked; }

  try {
    const scan = url ? await auditAiAct(url, { lang: l }) : null;
    // Scansione fallita e nessun questionario da valutare = busta vuota. Un 200
    // con `result: null` si legge come «nessun segnale trovato», che è il
    // contrario della verità: non è stato controllato niente. Con le risposte in
    // mano invece si prosegue (200) e la UI avvisa che la scansione è saltata.
    //
    // 424 e non 502 anche se «gateway» descriverebbe meglio il caso: davanti
    // all'app c'è Cloudflare, che di ogni 5xx dell'origine butta il corpo e
    // serve la propria pagina «Bad gateway». Verificato interrogando l'origine
    // in diretta: il JSON parte giusto e non arriva. I 4xx passano intatti,
    // quindi il messaggio utile all'utente sopravvive solo così. `424 Failed
    // Dependency` dice il vero: la richiesta è fallita perché è fallita una
    // dipendenza (il sito da scansionare), non l'analisi in sé.
    if (scan && !scan.fetchedOk && !answers) {
      if (scan.blocked) {
        // Il motivo si ricostruisce dalla chiave i18n del guard, non da
        // `scanError`: quello è italiano per costruzione (log e CLI), e cucito
        // dentro una frase inglese darebbe «That address cannot be scanned: IP
        // interno non consentito». Senza code si ripiega su `scanError`: un
        // motivo nella lingua sbagliata è meglio di nessun motivo.
        const detail = scan.scanCode ? msg(l, scan.scanCode, { detail: scan.scanDetail }) : scan.scanError;
        return Response.json({ error: msg(l, 'aiact.scan.rejected', { detail }) }, { status: 400 });
      }
      return Response.json({ error: msg(l, 'aiact.scan.unreachable') }, { status: 424 });
    }
    const signals = scan && scan.result ? scan.result.signals : null;
    const assessment = answers ? assessAiAct(answers, signals, l) : null;
    return Response.json({ scan, assessment });
  } catch (e) {
    // Input sbagliato = 400 col motivo tradotto; imprevisto = 500 generico + log.
    return failFromError(l, e, 'api/aiact');
  }
}

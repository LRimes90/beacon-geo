'use client';
import { useState } from 'react';
import ToolNav from '../nav';
import Turnstile from '../turnstile';
import { useLang, Rich } from '../i18n';
import { QUESTION_TEXT, REQUIRED } from './questions.mjs';

// Pagina AI Act: scansione della pagina (facoltativa) + autovalutazione.
// Le domande stanno in questions.js, gli obblighi e il verdetto nel motore
// (src/aiactAssess.js): qui non c'è nessuna regola giuridica, solo la resa.

const pin = (st) => (st === 'good' ? 'pin' : st === 'crit' ? 'pc' : 'pn');
const mark = (st) => (st === 'good' ? '✓' : st === 'crit' ? '✕' : st === 'warn' ? '▲' : '○');

// Il colore dice "quanta attenzione serve", non "quanto sei bravo": essere
// nell'ambito dell'AI Act non è un difetto, è un perimetro da presidiare.
const SCOPE_COLOR = { blocking: 'var(--crit)', contradiction: 'var(--warn)', in: 'var(--accent)', likely: 'var(--warn)', unlikely: 'var(--mid)', out: 'var(--good)' };
const SEV_COLOR = { blocking: 'var(--crit)', due: 'var(--warn)', conditional: 'var(--mid)', future: 'var(--faint)' };
// La chiave i18n del web È la stringa italiana: i livelli d'ambito vanno tradotti in parole, non in id.
const SCOPE_WORD = { in: 'dentro', likely: 'probabilmente dentro', unlikely: 'probabilmente fuori', out: 'fuori' };

export default function AiAct() {
  const { t, lang } = useLang();
  const [url, setUrl] = useState('');
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [tk, setTk] = useState('');

  const set = (id, value) => setAnswers((a) => ({ ...a, [id]: value }));
  // 'none' è esclusiva: sceglierla azzera le altre, scegliere un'altra la fa cadere.
  // Senza questa regola si può dire insieme "nessuna di queste" e "assunzioni": il
  // motore filtra 'none' e leggerebbe alto rischio, cioè la risposta opposta a quella
  // che l'utente crede di aver dato.
  const toggleMulti = (id, opt) => setAnswers((a) => {
    const cur = a[id] || [];
    if (opt === 'none') return { ...a, [id]: cur.includes('none') ? [] : ['none'] };
    const rest = cur.filter((x) => x !== 'none');
    return { ...a, [id]: rest.includes(opt) ? rest.filter((x) => x !== opt) : [...rest, opt] };
  });

  const ready = REQUIRED.every((id) => answers[id] !== undefined);

  async function run(e) {
    e.preventDefault();
    setLoading(true); setErr(''); setRes(null);
    try {
      const body = { answers, lang, turnstileToken: tk };
      if (url.trim()) body.url = url.trim();
      const r = await fetch('/api/aiact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || t('Analisi fallita — riprova tra poco.'));
      setRes(data);
    } catch (e2) { setErr(String(e2.message || e2)); }
    finally { setLoading(false); }
  }

  const av = res?.assessment;
  const scan = res?.scan?.result;
  const dates = av?.dates;

  return (
    <>
      <ToolNav active="aiact" tag="AI Act" />

      <main className="wrap">
        <div className="hero">
          <a className="back-home" href="https://lucarimediotti.com">&larr; {t('Torna a lucarimediotti.com')}</a>
          <div className="kicker">{t('AI Act · Reg. (UE) 2024/1689 · applicabile dal 2 agosto 2026')}</div>
          <h1><Rich s="L’AI Act *ti riguarda*?" /></h1>
          <p className="lede">{t('Dieci domande più una scansione della pagina: definisce il perimetro, elenca gli obblighi già in vigore e le scadenze. Vale anche dalla Svizzera — l’art. 2 §1 lett. c prende chi è fuori dall’UE quando il risultato del sistema è usato nell’Unione.')}</p>
        </div>

        <form onSubmit={run}>
          <input type="text" placeholder={t('iltuosito.ch (facoltativo)')} value={url} onChange={(e) => setUrl(e.target.value)} aria-label={t('Indirizzo del sito da analizzare (facoltativo)')} />
          <button type="submit" className="go" disabled={loading || !ready}>{loading ? t('Valuto…') : t('Valuta →')}</button>
        </form>
        <p className="opt" style={{ marginTop: 10 }}>{t('L’indirizzo serve a cercare in pagina chatbot, marcatori di provenienza e segnali di mercato UE. Senza indirizzo la valutazione usa solo le tue risposte.')}</p>
        <p className="opt">{t('Solo le prime due domande sono obbligatorie, ma una domanda senza risposta viene letta come «no»: rispondi a tutte per un perimetro completo.')}</p>
        <Turnstile onToken={setTk} />

        <section className="quiz">
          {Object.entries(QUESTION_TEXT).map(([id, q]) => {
            if (q.showIf && !answers[q.showIf]) return null;
            return (
              <fieldset key={id} className="qbox">
                <legend>{t(q.q)}</legend>
                {q.help && <p className="qhelp">{t(q.help)}</p>}
                {/* <details> nativo: si apre da tastiera, lo screen reader lo annuncia
                    come gruppo espandibile e non costa una riga di JS. Chiuso per
                    default — chi ha già capito la domanda non deve scorrere il resto. */}
                {(q.detail || q.examples?.length > 0) && (
                  <details className="qmore">
                    <summary>{t('Cosa significa · esempi')}</summary>
                    {q.detail && <p className="qdetail">{t(q.detail)}</p>}
                    {q.examples?.length > 0 && (
                      <ul className="qex">
                        {q.examples.map((ex, i) => <li key={i}>{t(ex)}</li>)}
                      </ul>
                    )}
                  </details>
                )}
                <div className="qopts">
                  {q.kind === 'bool' && ['yes', 'no'].map((v) => (
                    <button key={v} type="button"
                      className={'chip' + (answers[id] === (v === 'yes') ? ' on' : '')}
                      aria-pressed={answers[id] === (v === 'yes')}
                      onClick={() => set(id, v === 'yes')}>{v === 'yes' ? t('Sì') : t('No')}</button>
                  ))}
                  {q.kind === 'choice' && Object.entries(q.options).map(([v, label]) => (
                    <button key={v} type="button"
                      className={'chip' + (answers[id] === v ? ' on' : '')}
                      aria-pressed={answers[id] === v}
                      onClick={() => set(id, v)}>{t(label)}</button>
                  ))}
                  {q.kind === 'multi' && Object.entries(q.options).map(([v, label]) => (
                    <button key={v} type="button"
                      className={'chip' + ((answers[id] || []).includes(v) ? ' on' : '')}
                      aria-pressed={(answers[id] || []).includes(v)}
                      onClick={() => toggleMulti(id, v)}>{t(label)}</button>
                  ))}
                </div>
              </fieldset>
            );
          })}
        </section>

        <div className="notice">
          <span><strong>{t('Non è un parere legale.')}</strong> {t('Il risultato è un perimetro con la lista delle verifiche da fare. La qualificazione del ruolo e della classe di rischio va confermata da una persona competente.')}</span>
        </div>

        {err && <p className="err">⚠ {err}</p>}

        {av && (
          <section className="result">
            <div className="rhead">
              <div className="vmark" style={{ color: SCOPE_COLOR[av.verdict.headline] || 'var(--beam)' }}>
                {av.verdict.blocking ? '✕' : av.verdict.headline === 'out' ? '✓' : '◆'}
              </div>
              <div className="rmeta">
                <div className="verdict">{av.verdict.title}</div>
                <div className="sub">
                  {t('confidenza')}: {t(av.verdict.confidence === 'high' ? 'alta' : av.verdict.confidence === 'medium' ? 'media' : 'bassa')}
                  {' · '}{t('ambito materiale')}: {t(SCOPE_WORD[av.verdict.material])}
                  {' · '}{t('ambito territoriale')}: {t(SCOPE_WORD[av.verdict.territorial])}
                  {!av.verdict.scanned && ' · ' + t('senza scansione della pagina')}
                  {av.coverage?.missing?.length > 0
                    && ' · ' + t('perimetro parziale') + ' (' + av.coverage.answered + '/' + av.coverage.applicable + ')'}
                </div>
              </div>
            </div>

            {av.verdict.reasons.length > 0 && (
              <div className="rights" style={{ marginTop: 22 }}>
                <div className="rt">{t('Perché')}</div>
                <ul>{av.verdict.reasons.map((r, i) => <li key={i}><span className="pn">·</span> {r}</li>)}</ul>
              </div>
            )}

            <div className="rights" style={{ marginTop: 18 }}>
              <div className="rt">{t('Obblighi da presidiare')} <span className="info">— {av.obligations.length === 0 ? t('nessuno rilevato dalle risposte') : av.due.length === 0 ? t('nessuno già esigibile') : av.due.length + ' ' + t('già in vigore')}</span></div>
              {av.obligations.length === 0
                ? <p style={{ marginTop: 12, color: 'var(--muted)', fontSize: 14 }}>{t('Nessun obbligo dell’AI Act emerge dalle risposte. Restano gli obblighi di protezione dei dati se tratti dati personali.')}</p>
                : <ul className="oblist">
                    {av.obligations.map((o) => (
                      <li key={o.id}>
                        <span className="obsev" style={{ background: SEV_COLOR[o.severity] }} aria-hidden="true" />
                        <div>
                          <div className="oblab">{o.label}</div>
                          <div className="obmeta">
                            <code>{o.ref}</code>
                            {' · '}{o.from === 'in vigore' ? t('già in vigore') : o.inForce ? t('in vigore dal') + ' ' + o.from : t('dal') + ' ' + o.from}
                            {o.severity === 'conditional' && ' · ' + t('si applicherebbe solo con un nesso con l’UE')}
                            {o.why && ' · ' + o.why}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>}
            </div>

            {dates && (
              <div className="rights" style={{ marginTop: 18 }}>
                <div className="rt">{t('Scadenze di applicabilità')} <span className="info">— {t('art. 113, come modificato dal pacchetto Digital Omnibus')}</span></div>
                <ul>
                  <li><span className="pn">·</span> <code>{dates.prohibited}</code> — {t('pratiche vietate (art. 5) e alfabetizzazione IA (art. 4)')}</li>
                  <li><span className="pn">·</span> <code>{dates.gpai}</code> — {t('modelli di uso generale (art. 53-55)')}</li>
                  <li><span className="pn">·</span> <code>{dates.transparency}</code> — {t('trasparenza (art. 50), governance e sanzioni (art. 99)')}</li>
                  <li><span className="pn">·</span> <code>{dates.highRiskStandalone}</code> — {t('alto rischio, sistemi autonomi (art. 8-17, 26-27)')}</li>
                  <li><span className="pn">·</span> <code>{dates.highRiskEmbedded}</code> — {t('alto rischio incorporato in prodotti regolamentati')}</li>
                </ul>
              </div>
            )}

            {scan && (
              <div className="rights" style={{ marginTop: 18 }}>
                <div className="rt">{t('Segnali trovati nella pagina')} <span className="info">— {res.scan.host} · {scan.score === null ? t('nessun controllo valutabile: la pagina non espone segnali automatici') : scan.score + '/100 ' + t('segnali di trasparenza rilevabili')}</span></div>
                <ul>
                  {scan.checks.map((c, i) => (
                    <li key={i}><span className={pin(c.status)}>{mark(c.status)}</span> <span>{c.name} <code>{c.ref}</code> — {c.detail}</span></li>
                  ))}
                </ul>
              </div>
            )}

            {res.scan && !res.scan.fetchedOk && (
              <div className="notice" style={{ marginTop: 18 }}>
                <span>{t('Pagina non raggiungibile: la valutazione usa solo le tue risposte.')}</span>
              </div>
            )}

            <div className="fixes">
              <h3>{t('Da fare')}</h3>
              <ul>
                {av.obligations.filter((o) => o.severity === 'blocking').length > 0 && <li>{t('Sospendi l’uso della pratica vietata e documenta la valutazione: il divieto dell’art. 5 è già applicabile e non ammette adeguamento graduale.')}</li>}
                <li>{t('Metti per iscritto l’inventario dei sistemi di IA che usi: quale sistema, per cosa, chi lo supervisiona, quali dati tratta. È la base di ogni obbligo successivo.')}</li>
                <li>{t('Se un sistema parla con le persone, dichiaralo nel widget stesso al primo contatto — non solo nella privacy policy (art. 50 §1).')}</li>
                <li>{t('Aggiorna i contratti con i fornitori di IA: chi risponde di cosa, quali dati escono, dove sono trattati.')}</li>
                <li>{t('In Svizzera: nLPD e diritto d’autore si applicano comunque. Un progetto di legge svizzero sull’IA è atteso in consultazione entro fine 2026.')}</li>
              </ul>
            </div>

            <p className="disclaim">{av.disclaimer}</p>
          </section>
        )}
      </main>
    </>
  );
}

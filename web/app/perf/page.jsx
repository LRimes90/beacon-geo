'use client';
import { useState } from 'react';
import ToolNav from '../nav';
import Turnstile from '../turnstile';
import { useLang, Rich } from '../i18n';

const color = (s) => (s >= 90 ? 'var(--good)' : s >= 50 ? 'var(--warn)' : 'var(--crit)');
const pin = (st) => (st === 'good' ? 'pin' : st === 'crit' ? 'pc' : 'pn');
const mark = (st) => (st === 'good' ? '✓' : st === 'crit' ? '✕' : '▲');
const verdict = (s) => (s >= 90 ? 'Ottimo (Lighthouse >90)' : s >= 50 ? 'Da migliorare' : 'Critico');

export default function Perf() {
  const { t, lang } = useLang(); // lang: inviata all'API → locale PageSpeed nella lingua della UI
  const [url, setUrl] = useState('');
  const [strategy, setStrategy] = useState('mobile');
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [tk, setTk] = useState(''); // token Turnstile (vuoto = inerte)

  async function run(e) {
    e.preventDefault();
    setLoading(true); setErr(''); setRes(null);
    try {
      const r = await fetch('/api/perf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, strategy, turnstileToken: tk, lang }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || t('Analisi fallita — riprova tra poco.'));
      setRes(data);
    } catch (e2) { setErr(String(e2.message || e2)); }
    finally { setLoading(false); }
  }

  const p = res?.result;

  return (
    <>
      <ToolNav active="perf" tag="performance" />

      <main className="wrap">
        <div className="hero">
                    <a className="back-home" href="https://lucarimediotti.com">&larr; {t('Torna a lucarimediotti.com')}</a>
          <div className="kicker">Performance · Core Web Vitals · Lighthouse</div>
          <h1><Rich s="Quanto è *veloce* il tuo sito?" /></h1>
          <p className="lede">{t('Punteggio Lighthouse reale e Core Web Vitals via PageSpeed Insights di Google — gli stessi numeri che usano i motori di ricerca.')}</p>
        </div>

        <form onSubmit={run}>
          <input type="text" placeholder={t('iltuosito.it')} value={url} onChange={(e) => setUrl(e.target.value)} aria-label={t('Indirizzo del sito da analizzare')} />
          <button type="submit" className="go" disabled={loading || !url}>{loading ? t('Misuro…') : t('Misura →')}</button>
        </form>
        <label className="opt">
          <input type="checkbox" checked={strategy === 'desktop'} onChange={(e) => setStrategy(e.target.checked ? 'desktop' : 'mobile')} /> {t('Analizza come desktop (default: mobile)')}
        </label>
        <Turnstile onToken={setTk} />

        {err && <p className="err">⚠ {err}</p>}

        {res && !res.ok && (
          <div className="notice" style={{ marginTop: 18 }}><span>{t('Misurazione non riuscita:')} {res.reason}</span></div>
        )}

        {p && (
          <section className="result">
            <div className="rhead">
              <div style={{ fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 44, color: color(p.score) }}>{p.score}<span style={{ fontSize: 18, color: 'var(--muted)' }}>/100</span></div>
              <div className="rmeta">
                <div className="host">{res.url}</div>
                <div className="verdict">{t(verdict(p.score))}</div>
                <div className="sub">{t('Lighthouse · strategia')} {res.strategy}{p.field ? ` · dati reali utenti: ${p.field.category}` : ''}</div>
              </div>
            </div>

            <div className="rights" style={{ marginTop: 22 }}>
              <div className="rt">Core Web Vitals <span className="info">— {t('misurati in laboratorio')}</span></div>
              <ul>
                {p.metrics.map((m, i) => (
                  <li key={i}><span className={pin(m.status)}>{mark(m.status)}</span> {m.name} — {m.detail}</li>
                ))}
              </ul>
            </div>

            {p.opportunities.length > 0 && (
              <div className="fixes">
                <h3>{t('Dove guadagnare velocità')}</h3>
                <ul>{p.opportunities.map((o, i) => <li key={i}>{o.title} <em style={{ color: 'var(--muted)' }}>(~{(o.savingsMs / 1000).toFixed(1)}s)</em></li>)}</ul>
              </div>
            )}
          </section>
        )}
      </main>
    </>
  );
}

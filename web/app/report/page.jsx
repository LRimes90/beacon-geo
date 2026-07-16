'use client';
import { useState } from 'react';
import ToolNav from '../nav';
import Turnstile from '../turnstile';
import { useLang, Rich } from '../i18n';

const col = (s) => (s >= 80 ? 'var(--good)' : s >= 60 ? 'var(--warn)' : s >= 40 ? 'var(--mid)' : 'var(--crit)');
const colPerf = (s) => (s >= 90 ? 'var(--good)' : s >= 50 ? 'var(--warn)' : 'var(--crit)');

// delta before-after: per i punteggi positivo=meglio; per le violazioni axe (invert) negativo=meglio
function DeltaRow({ label, d, invert }) {
  if (typeof d !== 'number') return null;
  const same = d === 0;
  const better = invert ? d < 0 : d > 0;
  const c = same ? 'var(--muted)' : better ? 'var(--good)' : 'var(--crit)';
  return <li style={{ color: 'var(--muted)' }}><span style={{ color: c }}>{same ? '=' : better ? '▲' : '▼'}</span> {label}: <b style={{ color: c }}>{d > 0 ? '+' : ''}{d}</b></li>;
}

function Card({ label, score, sub, c }) {
  return (
    <div style={{ flex: 1, minWidth: 150, background: 'var(--card)', border: '1px solid var(--card-line)', borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ font: '600 11px/1 var(--mono)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>{label}</div>
      <div style={{ font: '700 40px/1.1 var(--serif)', margin: '.15em 0', color: score == null ? 'var(--faint)' : c }}>{score == null ? '—' : score}{score == null ? '' : <span style={{ font: '600 14px var(--mono)', color: 'var(--muted)' }}>/100</span>}</div>
      <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{sub}</div>
    </div>
  );
}

export default function Report() {
  const { t, lang } = useLang(); // lang: inviata alle API → scansione e report nella lingua della UI
  const [url, setUrl] = useState('');
  const [renderJs, setRenderJs] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [tk, setTk] = useState(''); // token Turnstile (vuoto = inerte)

  async function run(e) {
    e.preventDefault();
    setLoading(true); setErr(''); setRes(null);
    try {
      const r = await fetch('/api/full', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, renderJs, turnstileToken: tk, lang }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || t('Scansione fallita — riprova tra poco.'));
      setRes(data);
    } catch (e2) { setErr(String(e2.message || e2)); }
    finally { setLoading(false); }
  }

  async function download(format) {
    if (!res) return;
    setBusy(format);
    try {
      const r = await fetch('/api/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ suite: res, format, lang }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || t('Generazione fallita')); }
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `beacon-${res.host || 'sito'}.${format === 'md' ? 'md' : format}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e2) { setErr(String(e2.message || e2)); }
    finally { setBusy(''); }
  }

  const geoScore = res && res.geo && !res.geo.error ? res.geo.overall : null;
  const a11yScore = res && res.a11y && !res.a11y.error && res.a11y.result ? res.a11y.result.score : null;
  const axeV = res && res.a11y && res.a11y.axe && res.a11y.axe.ok ? res.a11y.axe.counts.violations : null;
  const perfScore = res && res.perf && res.perf.ok ? res.perf.result.score : null;

  return (
    <>
      <ToolNav active="report" tag="report" />
      <main className="wrap">
        <div className="hero">
                    <a className="back-home" href="https://lucarimediotti.com">&larr; {t('Torna a lucarimediotti.com')}</a>
          <div className="kicker">{t('Report completo · GEO · Accessibilità · Performance')}</div>
          <h1><Rich s="Un'unica *radiografia* del sito" /></h1>
          <p className="lede">{t('I tre tool in una sola scansione, in un report brandizzato pronto da consegnare al cliente.')}</p>
        </div>

        <form onSubmit={run}>
          <input type="text" placeholder={t('iltuosito.it')} value={url} onChange={(e) => setUrl(e.target.value)} aria-label={t('Indirizzo del sito da analizzare')} />
          <button type="submit" className="go" disabled={loading || !url}>{loading ? t('Scansiono…') : t('Scansione completa →')}</button>
        </form>
        <label className="opt"><input type="checkbox" checked={renderJs} onChange={(e) => setRenderJs(e.target.checked)} /> {t('Rendering JS per il GEO (siti SPA)')}</label>
        <Turnstile onToken={setTk} />

        {loading && <p className="err" style={{ color: 'var(--muted)' }}>{t('Eseguo i tre tool in parallelo — può richiedere ~30-60s (rendering + PageSpeed).')}</p>}
        {err && <p className="err">⚠ {err}</p>}

        {res && (
          <section className="result">
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Card label="GEO / AI" score={geoScore} sub={geoScore == null ? t('n/d') : 'AI-readiness'} c={col(geoScore || 0)} />
              <Card label={t('Accessibilità')} score={a11yScore} sub={axeV == null ? t('solo statico') : axeV + ' ' + t('violazioni axe')} c={col(a11yScore || 0)} />
              <Card label="Performance" score={perfScore} sub={perfScore == null ? t('chiave PSI mancante') : 'Lighthouse'} c={colPerf(perfScore || 0)} />
            </div>

            <div className="notice" style={{ marginTop: 18 }}>
              <span>{t('I tre punteggi')} <strong>{t('non si sommano')}</strong>: {t('misurano dimensioni diverse. Il report li presenta affiancati con il dettaglio dei fix.')}</span>
            </div>

            {res.history?.previous && res.history.delta && (
              <div className="rights" style={{ marginTop: 18 }}>
                <div className="rt">{t('Rispetto alla scansione precedente')} <span className="info">— {new Date(res.history.previous.ts).toLocaleDateString('it-CH')} · {res.history.count} {t('scansioni totali')}</span></div>
                <ul>
                  <DeltaRow label="GEO" d={res.history.delta.geo} />
                  <DeltaRow label={t('Accessibilità')} d={res.history.delta.a11y} />
                  <DeltaRow label="Performance" d={res.history.delta.perf} />
                  <DeltaRow label={t('Violazioni axe')} d={res.history.delta.axe} invert />
                </ul>
              </div>
            )}

            <div style={{ marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button type="button" className="dl" onClick={() => download('pdf')} disabled={busy === 'pdf'}>{busy === 'pdf' ? t('Genero…') : '⬇ ' + t('Report PDF')}</button>
              <button type="button" className="dl" onClick={() => download('html')} disabled={busy === 'html'}>⬇ HTML</button>
              <button type="button" className="dl" onClick={() => download('md')} disabled={busy === 'md'}>⬇ Markdown</button>
            </div>
          </section>
        )}
      </main>
    </>
  );
}

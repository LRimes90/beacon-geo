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

// nomi categoria GEO: stesse chiavi tradotte di app/page.jsx
const LABELS = {
  access: 'Accesso AI', agentFiles: 'File per agenti e AI', structured: 'Dati strutturati e SEO',
  readability: 'Leggibilità per le macchine', answerability: 'Risposta pronta per le AI', offsite: 'Visibilità off-site',
};
// chiamate t con stringa letterale: il test di copertura di test.js le trova e pretende la traduzione
const verdetto = (t, s) => (s >= 80 ? t('Buono') : s >= 60 ? t('Discreto') : s >= 40 ? t('Da migliorare') : t('Critico'));
const verdettoPerf = (t, s) => (s >= 90 ? t('Buono') : s >= 50 ? t('Da migliorare') : t('Critico'));
const PIN = { good: ['pin', '✓'], crit: ['pc', '✕'], bad: ['pc', '✕'], warn: ['pn', '!'] };
const pin = (s) => PIN[s] || ['pn', '○'];
const STATO = { good: 'var(--good)', warn: 'var(--warn)', crit: 'var(--crit)' };
const GRID = 'repeat(auto-fit, minmax(240px, 1fr))'; // a 360 px diventa una colonna
// «Da sistemare»: prima i critici, poi gli avvisi; gli informativi non sono difetti
const fixesOf = (checks) => [...checks.filter((c) => c.status === 'crit'), ...checks.filter((c) => c.status === 'warn')].map((c) => c.fix).filter(Boolean);

// Sezione di dettaglio sotto i riquadri: cosa è stato analizzato e cosa sistemare.
function Detail({ title, info, score, c, verdict, desc, children, fixes = [] }) {
  const { t } = useLang();
  return (
    <section className="rights" style={{ marginTop: 18 }}>
      <div className="rt" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <span>{title} <span className="info">· {info}</span></span>
        {score != null && <span style={{ font: '700 15px var(--mono)', color: c, letterSpacing: 0 }}>{score}/100 · {verdict}</span>}
      </div>
      <p style={{ fontSize: 13.5, color: 'var(--muted)', maxWidth: '70ch', margin: '6px 0 0' }}>{desc}</p>
      {children}
      {fixes.length > 0 && (
        <div style={{ borderTop: '1px solid var(--card-line)', marginTop: 14, paddingTop: 10 }}>
          <div style={{ font: '600 11px var(--mono)', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--warn)' }}>{t('Da sistemare')}</div>
          <ul style={{ marginTop: 8 }}>{fixes.slice(0, 3).map((f, i) => <li key={i}>→ {f}</li>)}</ul>
        </div>
      )}
    </section>
  );
}

function GeoDetail({ geo }) {
  const { t } = useLang();
  const cats = Object.keys(LABELS).filter((k) => geo.categories && geo.categories[k]);
  const all = cats.flatMap((k) => geo.categories[k].checks || []);
  return (
    <Detail title="GEO / AI" info={`${cats.length} ${t('aree')} · ${all.length} ${t('controlli')}`} score={geo.overall} c={col(geo.overall)} verdict={verdetto(t, geo.overall)}
      desc={t('Quanto il sito è leggibile e citabile da ChatGPT, Perplexity e Google AI: accesso dei crawler, file per gli agenti, dati strutturati, testo leggibile, risposte pronte, presenza fuori dal sito.')}
      fixes={fixesOf(all)}>
      <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: '14px 22px', marginTop: 14 }}>
        {cats.map((k) => {
          const cat = geo.categories[k];
          const checks = cat.checks || [];
          // gli informativi restano fuori dal conteggio: niente «0/0 ok» su categorie solo-info
          const scored = checks.filter((x) => x.status !== 'info');
          const nInfo = checks.length - scored.length;
          const okN = scored.filter((x) => x.status === 'good').length;
          const bad = scored.filter((x) => x.status !== 'good').map((x) => x.name).join(', ');
          const riga = [scored.length ? `${okN}/${scored.length} ${t('controlli ok')}` : '', nInfo ? `${nInfo} ${t('informativi')}` : '', bad].filter(Boolean).join(' · ');
          const s = cat.unmeasured ? null : cat.score;
          return (
            <div className="cat" key={k}>
              <div className="top"><span className="lab">{t(LABELS[k])}</span><span className="val" style={{ color: s == null ? 'var(--faint)' : col(s) }}>{s == null ? '—' : s}</span></div>
              <div className="bar" style={{ height: 7 }}>{s != null && <i style={{ width: s + '%', background: col(s) }} />}</div>
              <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 6 }}>{riga}</div>
            </div>
          );
        })}
      </div>
    </Detail>
  );
}

function A11yDetail({ a11y }) {
  const { t } = useLang();
  const { score, checks = [] } = a11y.result;
  return (
    <Detail title={t('Accessibilità')} info={`${checks.length} ${t('controlli WCAG 2.1 · statici')}`} score={score} c={col(score)} verdict={verdetto(t, score)}
      desc={t('Controlli WCAG 2.1 sull\'HTML servito: lingua, titoli, testi alternativi, etichette dei form, zoom, contrasto.')}
      fixes={fixesOf(checks)}>
      <ul style={{ gridTemplateColumns: GRID, gap: '9px 22px', marginTop: 14 }}>
        {checks.map((c, i) => {
          const [cls, ico] = pin(c.status);
          return <li key={i}><span className={cls}>{ico}</span><span><span style={{ color: 'var(--ink)' }}>{c.name}</span><br /><span style={{ fontSize: 12, color: 'var(--faint)' }}>{c.detail}</span></span></li>;
        })}
      </ul>
    </Detail>
  );
}

function PerfDetail({ perf, device }) {
  const { t, lang } = useLang();
  const info = 'Lighthouse · ' + (device === 'desktop' ? t('Computer') : t('Dispositivi mobili'));
  const desc = t('Velocità misurata in laboratorio sui Core Web Vitals, gli stessi indicatori che Google usa per valutare l\'esperienza.');
  // PSI desktop/mobile assente o fallito (chiave, quota, risposta senza perfDesktop): solo la nota
  if (!perf || !perf.ok || !perf.result) {
    return <Detail title="Performance" info={info} desc={desc}><p className="info" style={{ marginTop: 10 }}>{t('chiave PSI mancante')}</p></Detail>;
  }
  const { score, metrics = [], opportunities = [] } = perf.result;
  const nf = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 });
  const ms = (v) => (v >= 1000 ? nf.format(v / 1000) + ' s' : v + ' ms');
  return (
    <Detail title="Performance" info={info} score={score} c={colPerf(score)} verdict={verdettoPerf(t, score)} desc={desc}
      fixes={opportunities.map((o) => `${o.title} (~${ms(o.savingsMs)})`)}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginTop: 14 }}>
        {metrics.map((m) => (
          <div key={m.id} title={m.name} style={{ border: '1px solid var(--card-line)', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ font: '600 11px var(--mono)', color: 'var(--faint)' }}>{m.name.split(' · ')[0]}</div>
            <div style={{ font: '700 20px var(--serif)', color: STATO[m.status] || 'var(--ink)' }}>{m.detail}</div>
          </div>
        ))}
      </div>
    </Detail>
  );
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
  const [device, setDevice] = useState('mobile'); // switch Performance; resta tra una scansione e l'altra

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
  // riquadro e sezione Performance seguono lo switch; storico e delta restano su res.perf (mobile)
  const perfObj = res ? (device === 'desktop' ? res.perfDesktop : res.perf) : null;
  const perfScore = perfObj && perfObj.ok && perfObj.result ? perfObj.result.score : null;

  return (
    <>
      <ToolNav active="report" tag="report" />
      <main className="wrap">
        <header className="hero">
                    <a className="back-home" href="https://lucarimediotti.com">&larr; {t('Torna a lucarimediotti.com')}</a>
          <div className="kicker">{t('Report completo · GEO · Accessibilità · Performance')}</div>
          <h1><Rich s="Un'unica *radiografia* del sito" /></h1>
          <p className="lede">{t('I tre tool in una sola scansione, in un report brandizzato pronto da consegnare al cliente.')}</p>
        </header>

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
            {/* aria-pressed e non role="tab": cambia solo la Performance, non è un pannello a schede */}
            <div role="group" aria-label={t('Dispositivo')} style={{ display: 'inline-flex', gap: 4, padding: 4, marginBottom: 12, border: '1px solid var(--card-line)', borderRadius: 999 }}>
              {[['mobile', t('Dispositivi mobili')], ['desktop', t('Computer')]].map(([k, lab]) => (
                <button key={k} type="button" aria-pressed={device === k} onClick={() => setDevice(k)}
                  style={{ border: 0, borderRadius: 999, padding: '7px 14px', cursor: 'pointer', font: '600 13px var(--mono)', background: device === k ? 'var(--beam)' : 'transparent', color: device === k ? '#062018' : 'var(--muted)' }}>{lab}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Card label="GEO / AI" score={geoScore} sub={geoScore == null ? t('n/d') : 'AI-readiness'} c={col(geoScore || 0)} />
              <Card label={t('Accessibilità')} score={a11yScore} sub={axeV == null ? t('solo statico') : axeV + ' ' + t('violazioni axe')} c={col(a11yScore || 0)} />
              <Card label="Performance" score={perfScore} sub={perfScore == null ? t('chiave PSI mancante') : 'Lighthouse'} c={colPerf(perfScore || 0)} />
            </div>

            <aside className="notice" style={{ marginTop: 18 }}>
              <span>{t('I tre punteggi')} <strong>{t('non si sommano')}</strong>: {t('misurano dimensioni diverse. Il report li presenta affiancati con il dettaglio dei fix.')}</span>
            </aside>

            {res.history?.previous && res.history.delta && (
              <section className="rights" style={{ marginTop: 18 }}>
                <div className="rt">{t('Rispetto alla scansione precedente')} <span className="info">— {new Date(res.history.previous.ts).toLocaleDateString('it-CH')} · {res.history.count} {t('scansioni totali')}</span></div>
                {res.history.delta.profileChanged && (
                  <p className="info" style={{ margin: '4px 0 8px' }}>
                    {t('Il profilo dei pesi è cambiato')} ({res.history.delta.profileChanged.prev || '—'} → {res.history.delta.profileChanged.curr}): {t('il punteggio GEO non è confrontabile con la scansione precedente.')}
                  </p>
                )}
                <ul>
                  <DeltaRow label="GEO" d={res.history.delta.geo} />
                  <DeltaRow label={t('Accessibilità')} d={res.history.delta.a11y} />
                  <DeltaRow label="Performance" d={res.history.delta.perf} />
                  <DeltaRow label={t('Violazioni axe')} d={res.history.delta.axe} invert />
                </ul>
              </section>
            )}

            {geoScore != null && <GeoDetail geo={res.geo} />}
            {a11yScore != null && <A11yDetail a11y={res.a11y} />}
            <PerfDetail perf={perfObj} device={device} />

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

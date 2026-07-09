'use client';
import { useState } from 'react';
import ToolNav from './nav';

const LABELS = {
  access: 'Accesso AI', agentFiles: 'File per agenti e AI', structured: 'Dati strutturati e SEO',
  readability: 'Leggibilità per le macchine', offsite: 'Visibilità off-site',
};
const color = (s) => (s >= 80 ? 'var(--good)' : s >= 60 ? 'var(--warn)' : s >= 40 ? 'var(--mid)' : 'var(--crit)');
const verdict = (s) => (s >= 80 ? 'Buono' : s >= 60 ? 'Discreto' : s >= 40 ? 'Da migliorare' : 'Critico');

// --- icone (stroke = currentColor) ---
const I = {
  robot: <path d="M12 3v3m-5 0h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Zm2 5h.01M15 11h.01M9 15h6" />,
  file: <path d="M14 3H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7l-4-4Zm0 0v4h4M9 13h6M9 17h6" />,
  braces: <path d="M8 4a3 3 0 0 0-3 3v2a2 2 0 0 1-2 2 2 2 0 0 1 2 2v2a3 3 0 0 0 3 3m8-16a3 3 0 0 1 3 3v2a2 2 0 0 0 2 2 2 2 0 0 0-2 2v2a3 3 0 0 1-3 3" />,
  lines: <path d="M4 6h16M4 12h12M4 18h8" />,
  link: <path d="M9 15l6-6M10 6l1-1a4 4 0 0 1 6 6l-1 1M14 18l-1 1a4 4 0 0 1-6-6l1-1" />,
  shield: <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Zm-2.5 8.5 2 2 3.5-4" />,
  gear: <><circle cx="12" cy="12" r="3.2" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2.1 2.1M16.9 16.9 19 19M19 5l-2.1 2.1M7.1 16.9 5 19" /></>,
};
const Icon = ({ k }) => (
  <svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{I[k]}</svg>
);

const FEATURES = [
  { k: 'robot', t: 'Accesso AI', d: 'robots.txt e blocchi lato server, più un fetch dal vivo che impersona 5 crawler AI: verifichiamo se ti raggiungono davvero, non solo cosa dichiari.' },
  { k: 'file', t: 'File per agenti', d: 'llms.txt, sitemap e i formati emergenti per gli agenti — skill.md, .well-known/mcp.json, WebMCP. Qui quasi nessuno è ancora pronto.' },
  { k: 'braces', t: 'Dati strutturati e SEO', d: 'title, meta description, JSON-LD Schema.org, canonical, hreflang, Open Graph e Twitter Card: i segnali che spiegano alle macchine chi sei.' },
  { k: 'lines', t: 'Leggibilità macchina', d: 'quanto testo vede una macchina nell\'HTML servito, il peso della semantica, la gerarchia dei titoli e gli alt — con e senza JavaScript.' },
  { k: 'link', t: 'Visibilità off-site', d: 'accesso a CCBot e presenza in Common Crawl, il dataset su cui molti modelli si sono addestrati.' },
  { k: 'shield', t: 'Segnali e diritti AI', d: 'TDMRep, licenze RSL e Content-Signal: cosa dichiari alle AI su uso e addestramento. Lo mostriamo, non lo pesiamo.', info: true },
  { k: 'gear', t: 'Fondamentali tecnici', d: 'HTTPS, indicizzabilità (meta robots noindex), viewport mobile e risposta del server: le basi che, se mancano, azzerano tutto il resto.', info: true },
];

function Gauge({ score }) {
  const R = 56, C = 2 * Math.PI * R, off = C * (1 - score / 100);
  return (
    <svg className="gauge" viewBox="0 0 132 132" role="img" aria-label={`Punteggio ${score} su 100`}>
      <circle className="track" cx="66" cy="66" r={R} />
      <circle className="fill" cx="66" cy="66" r={R} stroke={color(score)} strokeDasharray={C} strokeDashoffset={off} transform="rotate(-90 66 66)" />
      <text className="num" x="66" y="70">{score}</text>
      <text className="unit" x="66" y="90">/ 100</text>
    </svg>
  );
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [renderJs, setRenderJs] = useState(false);
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');

  async function analyze(useJs) {
    setLoading(true); setErr(''); setRes(null);
    try {
      const r = await fetch('/api/audit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, renderJs: useJs }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Analisi fallita — riprova tra poco.');
      setRes(data);
    } catch (e2) { setErr(String(e2.message || e2)); }
    finally { setLoading(false); }
  }
  function run(e) { e.preventDefault(); analyze(renderJs); }
  function retryJs() { setRenderJs(true); analyze(true); }

  async function downloadLlms() {
    if (!res) return;
    const r = await fetch('/api/llms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: res.url }) });
    const txt = await r.text();
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'llms.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const fixes = res ? Object.values(res.categories).flatMap((c) => (c.checks || []).filter((k) => k.fix).map((k) => k.fix)) : [];

  return (
    <>
      <ToolNav active="geo" tag="AI-readiness" />

      <main className="wrap">
        <div className="hero">
          <div className="kicker">GEO · Generative Engine Optimization</div>
          <h1>Le AI <span className="hl">leggono</span> il tuo sito?</h1>
          <p className="lede">Inserisci l'indirizzo: in un attimo scopri cosa trovano i crawler AI, cosa gli sfugge e da dove partire per migliorare.</p>
        </div>

        <form onSubmit={run} id="analizza">
          <input type="text" placeholder="iltuosito.it" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Indirizzo del sito" />
          <button type="submit" className="go" disabled={loading || !url}>{loading ? 'Analizzo…' : 'Illumina →'}</button>
        </form>
        <label className="opt"><input type="checkbox" checked={renderJs} onChange={(e) => setRenderJs(e.target.checked)} /> Esegui anche il rendering JavaScript (mostra il contenuto delle SPA)</label>

        {err && <p className="err">⚠ {err}</p>}

        {res && (
          <section className="result">
            <div className="rhead">
              <Gauge score={res.overall} />
              <div className="rmeta">
                <div className="host">{res.url}</div>
                <div className="verdict">{verdict(res.overall)}</div>
                <div className="sub">{res.render?.ok ? 'analisi con rendering JS' : 'analisi HTML servito (no-JS)'}</div>
                <button type="button" className="dl" onClick={downloadLlms}>⬇ Genera il tuo llms.txt</button>
              </div>
            </div>

            {res.notice && (
              <div className={'notice ' + res.notice.type}>
                <span>{res.notice.msg}</span>
                {res.notice.type === 'maybe-spa' && !res.render?.ok && (
                  <button type="button" className="retry" onClick={retryJs} disabled={loading}>Riprova con rendering JS</button>
                )}
              </div>
            )}

            <div className="cats">
              {Object.entries(LABELS).map(([k, label]) => {
                const s = res.categories[k].score;
                return (
                  <div className="cat" key={k}>
                    <div className="top"><span className="lab">{label}</span><span className="val" style={{ color: color(s) }}>{s}</span></div>
                    <div className="bar"><i style={{ width: s + '%', background: color(s) }} /></div>
                  </div>
                );
              })}
            </div>

            {res.tech && (
              <div className="rights">
                <div className="rt">Fondamentali tecnici <span className="info">— informativo, non incide sul punteggio</span></div>
                <ul>
                  {res.tech.checks.map((c, i) => (
                    <li key={i}><span className={c.status === 'good' ? 'pin' : c.status === 'crit' ? 'pc' : 'pn'}>{c.status === 'good' ? '✓' : c.status === 'crit' ? '✕' : '○'}</span> {c.name} — {c.detail}</li>
                  ))}
                </ul>
              </div>
            )}

            {res.rights && (
              <div className="rights">
                <div className="rt">Segnali e diritti AI <span className="info">— informativo, non incide sul punteggio</span></div>
                <ul>
                  {res.rights.checks.map((c, i) => (
                    <li key={i}><span className={c.status === 'good' ? 'pin' : 'pn'}>{c.status === 'good' ? '✓' : '○'}</span> {c.name} — {c.detail}</li>
                  ))}
                </ul>
              </div>
            )}

            {fixes.length > 0 && (
              <div className="fixes">
                <h3>Azioni consigliate</h3>
                <ul>{fixes.slice(0, 8).map((f, i) => <li key={i}>{f}</li>)}</ul>
              </div>
            )}
          </section>
        )}

        <section className="features" id="controlli">
          <div className="kicker">Cosa controlliamo</div>
          <p className="fintro">Cinque categorie fanno il punteggio; le ultime due sono controlli informativi. Tutto misurato sull'HTML servito — senza fidarci solo di ciò che il sito dichiara.</p>
          <div className="speclist">
            {FEATURES.map((f) => (
              <div className={'specrow' + (f.info ? ' info' : '')} key={f.t}>
                <div className="spec-h">
                  <span className="ic"><Icon k={f.k} /></span>
                  <h3>{f.t}{f.info && <span className="badge" aria-hidden="true">info</span>}</h3>
                </div>
                <p>{f.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="features" id="suite" style={{ marginTop: 44 }}>
          <div className="kicker">La suite Beacon</div>
          <p className="fintro">Non solo GEO. Beacon controlla anche l'accessibilità (WCAG/EAA) e la performance, e le unisce in un report unico pronto per il cliente.</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a className="dl" href="/a11y">Accessibilità · WCAG/EAA →</a>
            <a className="dl" href="/perf">Performance · Lighthouse →</a>
            <a className="dl" href="/report">Report completo →</a>
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="foot-in">
          <div className="fleft">
            <div className="fbrand">Beacon <span className="hl">🔦</span></div>
            <p className="fdesc">Suite gratuita che misura cosa vedono del tuo sito le AI, gli screen reader e i motori: GEO, accessibilità (WCAG/EAA) e performance.</p>
          </div>
          <a className="ghlink" href="https://github.com/LRimes90/beacon-geo" target="_blank" rel="noreferrer"><span className="star">★</span> Codice su GitHub</a>
        </div>
        <div className="foot-bot">
          <span>© 2026 Beacon · open source</span>
          <span>Un progetto di Luca Rimediotti</span>
        </div>
      </footer>
    </>
  );
}

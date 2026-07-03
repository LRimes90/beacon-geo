'use client';
import { useState } from 'react';

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
};
const Icon = ({ k }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{I[k]}</svg>
);

const FEATURES = [
  { k: 'robot', t: 'Accesso AI', d: 'robots.txt e blocchi lato server, più un fetch dal vivo che impersona 5 crawler AI: verifichiamo se ti raggiungono davvero, non solo cosa dichiari.' },
  { k: 'file', t: 'File per agenti', d: 'llms.txt, sitemap e i formati emergenti per gli agenti — skill.md, .well-known/mcp.json, WebMCP. Qui quasi nessuno è ancora pronto.' },
  { k: 'braces', t: 'Dati strutturati e SEO', d: 'title, meta description, JSON-LD Schema.org, canonical, hreflang, Open Graph e Twitter Card: i segnali che spiegano alle macchine chi sei.' },
  { k: 'lines', t: 'Leggibilità macchina', d: 'quanto testo vede una macchina nell\'HTML servito, il peso della semantica, la gerarchia dei titoli e gli alt — con e senza JavaScript.' },
  { k: 'link', t: 'Visibilità off-site', d: 'accesso a CCBot e presenza in Common Crawl, il dataset su cui molti modelli si sono addestrati.' },
  { k: 'shield', t: 'Segnali e diritti AI', d: 'TDMRep, licenze RSL e Content-Signal: cosa dichiari alle AI su uso e addestramento. Lo mostriamo, non lo pesiamo.', info: true },
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

  async function run(e) {
    e.preventDefault();
    setLoading(true); setErr(''); setRes(null);
    try {
      const r = await fetch('/api/audit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, renderJs }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Errore');
      setRes(data);
    } catch (e2) { setErr(String(e2.message || e2)); }
    finally { setLoading(false); }
  }

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
      <header className="topbar">
        <div className="bar-in">
          <div className="brand"><span className="dot" />Beacon<span className="tag">AI-readiness</span></div>
          <a className="ghlink" href="https://github.com/" target="_blank" rel="noreferrer"><span className="star">★</span> open source</a>
        </div>
      </header>

      <main className="wrap">
        <div className="hero">
          <div className="kicker">GEO · Generative Engine Optimization</div>
          <h1>Le AI <span className="hl">leggono</span><br />il tuo sito?</h1>
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
          <p className="fintro">Cinque categorie fanno il punteggio, la sesta è informativa. Tutto misurato sull'HTML servito — senza fidarci solo di ciò che il sito dichiara.</p>
          <div className="speclist">
            {FEATURES.map((f) => (
              <div className={'specrow' + (f.info ? ' info' : '')} key={f.t}>
                <div className="spec-h">
                  <span className="ic"><Icon k={f.k} /></span>
                  <h3>{f.t}{f.info && <span className="badge">info</span>}</h3>
                </div>
                <p>{f.d}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="foot-in">
          <div className="foot-top">
            <div>
              <div className="fbrand">Beacon <span className="hl">🔦</span></div>
              <p className="fdesc">Il linter di AI-readiness open source. Analizza cosa vedono davvero i crawler AI — e come renderti leggibile agli agenti.</p>
            </div>
            <div>
              <h4>Il metodo</h4>
              <ul>
                <li><a href="#analizza">Analizza un sito</a></li>
                <li><a href="#controlli">I 6 controlli</a></li>
                <li><a href="#analizza">Genera il tuo llms.txt</a></li>
              </ul>
            </div>
            <div>
              <h4>Open source</h4>
              <ul>
                <li><a href="https://github.com/" target="_blank" rel="noreferrer">GitHub</a></li>
                <li><a href="#">Licenza MIT</a></li>
                <li><a href="#">Contribuisci</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="foot-bot">
          <span>© 2026 Beacon · motore open-source</span>
          <span>Un progetto di Luca Rimediotti</span>
        </div>
      </footer>
    </>
  );
}

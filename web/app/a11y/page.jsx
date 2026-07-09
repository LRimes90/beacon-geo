'use client';
import { useState } from 'react';
import ToolNav from '../nav';

const color = (s) => (s >= 80 ? 'var(--good)' : s >= 60 ? 'var(--warn)' : s >= 40 ? 'var(--mid)' : 'var(--crit)');
const pin = (st) => (st === 'good' ? 'pin' : st === 'crit' ? 'pc' : 'pn');
const mark = (st) => (st === 'good' ? '✓' : st === 'crit' ? '✕' : st === 'warn' ? '▲' : '○');

// Overlay diagnostico ONESTO: evidenzia i problemi in pagina, NON li corregge (niente live-patch).
const OVERLAY_SRC = `(function(){var s=document.createElement('style');s.textContent='.bcn-flag{outline:3px solid #F0664B !important;outline-offset:2px}.bcn-lbl{position:absolute;z-index:2147483647;background:#F0664B;color:#fff;font:700 11px/1 monospace;padding:3px 6px;border-radius:4px;transform:translateY(-100%)}.bcn-bar{position:fixed;top:12px;right:12px;z-index:2147483647;background:#0A1E1C;color:#EAF3F1;font:600 13px/1.5 monospace;padding:12px 16px;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.4);max-width:280px}.bcn-bar b{color:#42D1C8}.bcn-bar .x{cursor:pointer;color:#9DB4B0;float:right;margin-left:10px}';document.head.appendChild(s);var n=0;function flag(el,txt){el.classList.add('bcn-flag');var r=el.getBoundingClientRect();var l=document.createElement('span');l.className='bcn-lbl';l.textContent=txt;l.style.left=(r.left+scrollX)+'px';l.style.top=(r.top+scrollY)+'px';document.body.appendChild(l);n++;}[].forEach.call(document.querySelectorAll('img:not([alt])'),function(el){flag(el,'img senza alt');});[].forEach.call(document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]),select,textarea'),function(el){var id=el.getAttribute('id');var lab=id&&document.querySelector('label[for=\"'+id+'\"]');if(!lab&&!el.getAttribute('aria-label')&&!el.getAttribute('aria-labelledby')&&!el.closest('label')){flag(el,'campo senza label');}});var lang=document.documentElement.getAttribute('lang');var bar=document.createElement('div');bar.className='bcn-bar';bar.innerHTML='<span class=\"x\">✕</span><b>Beacon overlay</b><br>'+n+' elementi da correggere<br>'+(lang?'lang: '+lang:'⚠ manca lang su &lt;html&gt;')+'<br><small style=\"color:#9DB4B0\">Diagnostico: evidenzia, non corregge.</small>';document.body.appendChild(bar);bar.querySelector('.x').onclick=function(){[].forEach.call(document.querySelectorAll('.bcn-flag'),function(e){e.classList.remove('bcn-flag');});[].forEach.call(document.querySelectorAll('.bcn-lbl'),function(e){e.remove();});bar.remove();s.remove();};})();`;
const BOOKMARKLET = 'javascript:' + encodeURIComponent(OVERLAY_SRC);

export default function A11y() {
  const [url, setUrl] = useState('');
  const [deep, setDeep] = useState(false);
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  async function run(e) {
    e.preventDefault();
    setLoading(true); setErr(''); setRes(null);
    try {
      const r = await fetch('/api/a11y', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, deep }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Analisi fallita — riprova tra poco.');
      setRes(data);
    } catch (e2) { setErr(String(e2.message || e2)); }
    finally { setLoading(false); }
  }

  async function downloadStatement() {
    if (!res) return;
    const r = await fetch('/api/statement', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audit: res }) });
    const txt = await r.text();
    const blob = new Blob([txt], { type: 'text/markdown;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'dichiarazione-accessibilita-' + (res.host || 'sito') + '.md';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function copyBookmarklet() {
    navigator.clipboard.writeText(BOOKMARKLET).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }

  const a = res?.result;
  const fixes = a ? a.checks.filter((c) => c.fix && c.status !== 'good').map((c) => c.fix) : [];

  return (
    <>
      <ToolNav active="a11y" tag="a11y" />

      <main className="wrap">
        <div className="hero">
          <div className="kicker">Accessibilità · WCAG 2.1 · European Accessibility Act</div>
          <h1>Il tuo sito è <span className="hl">accessibile</span>?</h1>
          <p className="lede">Controlli statici a colpo sicuro sull'HTML servito — quelli che si possono verificare in automatico senza margine d'errore.</p>
        </div>

        <form onSubmit={run}>
          <input type="text" placeholder="iltuosito.it" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Indirizzo del sito da analizzare" />
          <button type="submit" className="go" disabled={loading || !url}>{loading ? 'Analizzo…' : 'Controlla →'}</button>
        </form>
        <label className="opt"><input type="checkbox" checked={deep} onChange={(e) => setDeep(e.target.checked)} /> Analisi approfondita con axe-core (rendering reale: contrasto, ARIA, ~50% dei criteri)</label>

        <div className="notice">
          <span><strong>Non è un audit di conformità.</strong> Anche con axe-core il test automatico copre al massimo ~metà dei criteri WCAG. Tastiera, ordine di focus e senso del contenuto per screen reader richiedono verifica umana.</span>
        </div>

        {err && <p className="err">⚠ {err}</p>}

        {a && (
          <section className="result">
            <div className="rhead">
              <div style={{ fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 44, color: color(a.score) }}>{a.score}<span style={{ fontSize: 18, color: 'var(--muted)' }}>/100</span></div>
              <div className="rmeta">
                <div className="host">{res.url}</div>
                <div className="sub">controlli statici superati (i "info" non contano nel punteggio)</div>
                <button type="button" className="dl" onClick={downloadStatement}>⬇ Bozza dichiarazione di accessibilità</button>
              </div>
            </div>

            <div className="rights" style={{ marginTop: 22 }}>
              <div className="rt">Controlli WCAG 2.1 <span className="info">— statici, dall'HTML servito</span></div>
              <ul>
                {a.checks.map((c, i) => (
                  <li key={i}><span className={pin(c.status)}>{mark(c.status)}</span> {c.name} — {c.detail}</li>
                ))}
              </ul>
            </div>

            {res.axe && res.axe.ok && (
              <div className="rights" style={{ marginTop: 18 }}>
                <div className="rt">axe-core · WCAG 2.1 A/AA <span className="info">— {res.axe.counts.violations} violazioni · {res.axe.counts.passes} passati · {res.axe.counts.incomplete} da verificare a mano</span></div>
                {res.axe.findings.length === 0
                  ? <p style={{ marginTop: 12, color: 'var(--good)', fontSize: 14 }}>✓ Nessuna violazione automatica rilevata da axe-core.</p>
                  : <ul className="axelist">
                      {res.axe.findings.map((f, i) => (
                        <li key={i}>
                          <div className="afind">
                            <span className={pin(f.status)}>{mark(f.status)}</span>
                            <span><a href={f.helpUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>{f.help}</a> — <em>{f.impact}</em>, {f.nodes} {f.nodes === 1 ? 'elemento' : 'elementi'}</span>
                          </div>
                          <details className="remedy">
                            <summary>Come correggere</summary>
                            {f.remedy?.why && <p className="why">{f.remedy.why}</p>}
                            {f.failureSummary && <pre className="fsum">{f.failureSummary}</pre>}
                            {f.remedy?.before && <div className="ba"><span className="bl">prima</span><pre>{f.remedy.before}</pre></div>}
                            {f.remedy?.after
                              ? <div className="ba"><span className="al">dopo</span><pre>{f.remedy.after}</pre></div>
                              : <p className="why">Esempio e dettaglio completo: <a href={f.helpUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>guida axe ↗</a></p>}
                          </details>
                        </li>
                      ))}
                    </ul>}
              </div>
            )}

            {res.axe && !res.axe.ok && (
              <div className="notice" style={{ marginTop: 18 }}>
                <span>Scansione approfondita non disponibile: {res.axe.reason}</span>
              </div>
            )}

            {fixes.length > 0 && (
              <div className="fixes">
                <h3>Da sistemare</h3>
                <ul>{fixes.map((f, i) => <li key={i}>{f}</li>)}</ul>
              </div>
            )}
          </section>
        )}

        <section className="features" style={{ marginTop: 56 }}>
          <div className="kicker">Overlay diagnostico</div>
          <p className="fintro">Trascina il pulsante nella barra dei preferiti, poi cliccalo su qualsiasi pagina: evidenzia immagini senza <code>alt</code>, campi senza etichetta e la lingua mancante, direttamente sul sito. <strong>È diagnostico — mostra i problemi, non li corregge</strong> (nessun widget che patcha il DOM).</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <a className="dl" href={BOOKMARKLET} onClick={(e) => e.preventDefault()} draggable="true" style={{ cursor: 'grab' }}>🔦 Beacon overlay</a>
            <button type="button" className="dl" onClick={copyBookmarklet}>{copied ? '✓ Copiato' : 'Copia il codice'}</button>
          </div>
        </section>
      </main>
    </>
  );
}

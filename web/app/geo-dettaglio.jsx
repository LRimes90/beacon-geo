'use client';
// Pezzi del dettaglio GEO condivisi da / (home) e /report: stessa riga di sintesi, stessi colori,
// stesso blocco «Da sistemare». Estratti da report/page.jsx senza cambiarne il comportamento.
import { useLang } from './i18n';
import { rigaCategoria } from './report/riga.mjs';

// nomi categoria GEO (chiavi del dizionario: la stringa italiana)
export const LABELS = {
  access: 'Accesso AI', agentFiles: 'File per agenti e AI', structured: 'Dati strutturati e SEO',
  readability: 'Leggibilità per le macchine', answerability: 'Risposta pronta per le AI', offsite: 'Visibilità off-site',
};
export const col = (s) => (s >= 80 ? 'var(--good)' : s >= 60 ? 'var(--warn)' : s >= 40 ? 'var(--mid)' : 'var(--crit)');
const PIN = { good: ['pin', '✓'], crit: ['pc', '✕'], bad: ['pc', '✕'], warn: ['pn', '!'] };
export const pin = (s) => PIN[s] || ['pn', '○'];
// «Da sistemare»: prima i critici, poi gli avvisi; gli informativi non sono difetti
export const fixesOf = (checks) => [...checks.filter((c) => c.status === 'crit'), ...checks.filter((c) => c.status === 'warn')].map((c) => c.fix).filter(Boolean);

// Una categoria: nome, punteggio, barra e riga di sintesi (conteggio controlli, quelli falliti, gli informativi).
export function CategoriaGeo({ k, cat }) {
  const { t } = useLang();
  const s = cat.unmeasured ? null : cat.score;
  return (
    <div className="cat">
      <div className="top"><span className="lab">{t(LABELS[k])}</span><span className="val" style={{ color: s == null ? 'var(--faint)' : col(s) }}>{s == null ? '—' : s}</span></div>
      <div className="bar" style={{ height: 7 }}>{s != null && <i style={{ width: s + '%', background: col(s) }} />}</div>
      <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 6 }}>{rigaCategoria(cat.checks || [], t)}</div>
    </div>
  );
}

// Blocco «Da sistemare»: `max` voci (3 in /report, 8 in home dove prima c'era la lista piatta).
export function DaSistemare({ fixes, max = 3 }) {
  const { t } = useLang();
  if (!fixes.length) return null;
  return (
    <div style={{ borderTop: '1px solid var(--card-line)', marginTop: 14, paddingTop: 10 }}>
      <div style={{ font: '600 11px var(--mono)', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--warn)' }}>{t('Da sistemare')}</div>
      <ul style={{ marginTop: 8 }}>{fixes.slice(0, max).map((f, i) => <li key={i}>→ {f}</li>)}</ul>
    </div>
  );
}

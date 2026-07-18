'use client';
import { useState } from 'react';
import { useLang } from './i18n';
import { LANGS } from './translations';

// Menu condiviso dei tool Beacon. Aggiungere un tool = una riga in TOOLS.
const TOOLS = [
  { href: '/', key: 'geo', label: 'GEO checker' },
  { href: '/a11y', key: 'a11y', label: 'Accessibilità' },
  { href: '/perf', key: 'perf', label: 'Performance' },
  { href: '/report', key: 'report', label: 'Report completo' },
];

export default function ToolNav({ active, tag }) {
  const { t, lang, setLang } = useLang();
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const activeLang = LANGS.find((l) => l.code === lang) || LANGS[0];

  // Desktop: .toolmenu e .lang-switch sono inline. Mobile (≤768px, via CSS):
  // diventano tendine controllate da .menu-open / .lang-open sulla topbar;
  // hamburger e bandiera-trigger compaiono solo lì.
  const cls = 'topbar' + (menuOpen ? ' menu-open' : '') + (langOpen ? ' lang-open' : '');

  return (
    <header className={cls}>
      <div className="bar-in">
        <a className="brand" href="/" style={{ textDecoration: 'none' }}>
          <span className="dot" />Beacon{tag && <span className="tag">{t(tag)}</span>}
        </a>

        <nav className="toolmenu" aria-label={t('Strumenti Beacon')}>
          {TOOLS.map((tool) => (
            <a key={tool.key} href={tool.href}
               className={'toollink' + (tool.key === active ? ' on' : '')}
               aria-current={tool.key === active ? 'page' : undefined}
               onClick={() => setMenuOpen(false)}>{t(tool.label)}</a>
          ))}
        </nav>

        <div className="lang-switch" role="group" aria-label="Lingua">
          {LANGS.map((l) => (
            <button key={l.code} type="button"
              className={'lang' + (l.code === lang ? ' active' : '')}
              aria-label={l.label} aria-pressed={l.code === lang}
              onClick={() => { setLang(l.code); setLangOpen(false); }}>
              <span className={`fi fi-${l.iso} lang-flag`} aria-hidden="true"></span><span className="lang-name">{l.label}</span>
            </button>
          ))}
        </div>

        {/* Solo mobile: bandiera della lingua attiva → apre la tendina lingue. */}
        <button className="lang-trigger" type="button"
          aria-label="Lingua" aria-expanded={langOpen}
          onClick={() => { setLangOpen((o) => !o); setMenuOpen(false); }}>
          <span className={`fi fi-${activeLang.iso} lang-flag`} aria-hidden="true"></span>
        </button>

        {/* Solo mobile: hamburger → X, apre la tendina voci. */}
        <button className={'burger' + (menuOpen ? ' open' : '')} type="button"
          aria-label="Menu" aria-expanded={menuOpen}
          onClick={() => { setMenuOpen((o) => !o); setLangOpen(false); }}>
          <span /><span /><span />
        </button>
      </div>
    </header>
  );
}

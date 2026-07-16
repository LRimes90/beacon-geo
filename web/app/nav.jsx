'use client';
import { useLang, LangSwitch } from './i18n';

// Menu condiviso dei tool Beacon. Aggiungere un tool = una riga in TOOLS.
const TOOLS = [
  { href: '/', key: 'geo', label: 'GEO checker' },
  { href: '/a11y', key: 'a11y', label: 'Accessibilità' },
  { href: '/perf', key: 'perf', label: 'Performance' },
  { href: '/report', key: 'report', label: 'Report completo' },
];

export default function ToolNav({ active, tag }) {
  const { t } = useLang();
  return (
    <header className="topbar">
      <div className="bar-in">
        <a className="brand" href="/" style={{ textDecoration: 'none' }}>
          <span className="dot" />Beacon{tag && <span className="tag">{t(tag)}</span>}
        </a>
        <nav className="toolmenu" aria-label={t('Strumenti Beacon')}>
          {TOOLS.map((tool) => (
            <a key={tool.key} href={tool.href}
               className={'toollink' + (tool.key === active ? ' on' : '')}
               aria-current={tool.key === active ? 'page' : undefined}>{t(tool.label)}</a>
          ))}
        </nav>
        <LangSwitch />
      </div>
    </header>
  );
}

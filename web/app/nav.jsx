'use client';
// Menu condiviso dei tool Beacon. Aggiungere un tool = una riga in TOOLS.
const TOOLS = [
  { href: '/', key: 'geo', label: 'GEO checker' },
  { href: '/a11y', key: 'a11y', label: 'Accessibilità' },
  { href: '/perf', key: 'perf', label: 'Performance' },
];

export default function ToolNav({ active, tag }) {
  return (
    <header className="topbar">
      <div className="bar-in">
        <a className="brand" href="/" style={{ textDecoration: 'none' }}>
          <span className="dot" />Beacon{tag && <span className="tag">{tag}</span>}
        </a>
        <nav className="toolmenu" aria-label="Strumenti Beacon">
          {TOOLS.map((t) => (
            <a key={t.key} href={t.href}
               className={'toollink' + (t.key === active ? ' on' : '')}
               aria-current={t.key === active ? 'page' : undefined}>{t.label}</a>
          ))}
        </nav>
      </div>
    </header>
  );
}

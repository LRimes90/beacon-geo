'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { DICTS, LANGS } from './translations';

// i18n client-side come su lucarimediotti.com: la chiave È la stringa italiana,
// i dizionari mappano IT → lingua. Fallback = italiano (chiave mancante o lang=it).
// Fase 1: solo UI; i risultati del motore restano in italiano.

const LangCtx = createContext({ lang: 'it', setLang: () => {}, t: (s) => s });

export function LangProvider({ children }) {
  const [lang, setLangState] = useState('it');

  useEffect(() => {
    const saved = localStorage.getItem('beacon-lang');
    if (saved && (saved === 'it' || DICTS[saved])) {
      setLangState(saved);
      document.documentElement.lang = saved;
    }
  }, []);

  const setLang = (l) => {
    setLangState(l);
    localStorage.setItem('beacon-lang', l);
    document.documentElement.lang = l;
  };

  const t = (s) => (lang === 'it' ? s : (DICTS[lang]?.[s] ?? s));

  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>;
}

export const useLang = () => useContext(LangCtx);

// Testo con evidenziazione: nella chiave i segmenti tra *asterischi* diventano
// <span className="hl">…</span>. Così i traduttori restano liberi sull'ordine
// delle parole (es. 'Le AI *leggono* il tuo sito?' → 'Do AIs *read* your site?').
export function Rich({ s }) {
  const { t } = useLang();
  return t(s).split('*').map((part, i) => (i % 2 ? <span className="hl" key={i}>{part}</span> : part));
}

// Selettore lingua a bandiere, come sul sito principale.
export function LangSwitch() {
  const { lang, setLang } = useLang();
  return (
    <div className="lang-switch" role="group" aria-label="Lingua">
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          className={'lang' + (lang === l.code ? ' active' : '')}
          aria-label={l.label}
          aria-pressed={lang === l.code}
          onClick={() => setLang(l.code)}
        >{l.flag}</button>
      ))}
    </div>
  );
}

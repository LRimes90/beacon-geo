'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { DICTS, LANGS } from './translations';

// i18n client-side come su lucarimediotti.com: la chiave È la stringa italiana,
// i dizionari mappano IT → lingua. Fallback = italiano (chiave mancante o lang=it).
// Fase 1: solo UI; i risultati del motore restano in italiano.
//
// La lingua è CONDIVISA con lucarimediotti.com tramite un cookie `lr_lang` sul
// dominio parent (.lucarimediotti.com), visibile ad apex e sottodomini — cosa
// che localStorage non può fare (è isolato per-origin). Su host diversi
// (es. anteprime) il cookie resta host-only e si ripiega su localStorage.

const COOKIE = 'lr_lang';
const VALID = ['it', 'en', 'de', 'fr', 'es', 'pt'];

// Su *.lucarimediotti.com condivide il cookie tra i siti; altrove host-only.
function cookieDomain() {
  return /(^|\.)lucarimediotti\.com$/.test(location.hostname) ? '; domain=.lucarimediotti.com' : '';
}
function readSharedLang() {
  var m = typeof document !== 'undefined' && document.cookie.match(/(?:^|;\s*)lr_lang=([^;]+)/);
  var v = m ? decodeURIComponent(m[1]) : null;
  return VALID.includes(v) ? v : null;
}
function writeSharedLang(lang) {
  const secure = location.protocol === 'https:' ? '; Secure' : ''; // Secure solo su HTTPS (non rompe dev http)
  document.cookie = COOKIE + '=' + encodeURIComponent(lang) + '; path=/; max-age=31536000; SameSite=Lax' + secure + cookieDomain();
}

const LangCtx = createContext({ lang: 'it', setLang: () => {}, t: (s) => s });

export function LangProvider({ children }) {
  const [lang, setLangState] = useState('it');

  useEffect(() => {
    // Priorità: cookie condiviso (scelta fatta su uno dei due siti) → localStorage locale → it.
    let saved = readSharedLang();
    if (!saved) {
      const ls = localStorage.getItem('beacon-lang');
      if (ls && (ls === 'it' || DICTS[ls])) saved = ls;
    }
    if (saved) {
      setLangState(saved);
      document.documentElement.lang = saved;
    }
  }, []);

  const setLang = (l) => {
    setLangState(l);
    localStorage.setItem('beacon-lang', l); // cache locale
    writeSharedLang(l);                      // sorgente condivisa coi due siti
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

// Selettore lingua a bandiere (desktop). Il menu mobile ha il suo, in nav.jsx.
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

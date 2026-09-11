// Regole di URL per lingua, condivise da middleware, layout, nav e sitemap.
// Nessun 'use client': è un modulo neutro, importabile da entrambi i lati.
// L'italiano NON ha prefisso: gli URL già indicizzati restano quelli.

export const LOCALES = ['it', 'en', 'de', 'fr', 'es', 'pt'];
export const PREFIXED = LOCALES.filter((l) => l !== 'it');

const RE = new RegExp(`^/(${PREFIXED.join('|')})(/.*)?$`);

// ('en', '/a11y') → '/en/a11y' · ('en', '/') → '/en' · ('it', qualsiasi) → invariato
export function langPath(lang, path = '/') {
  if (lang === 'it') return path;
  return path === '/' ? `/${lang}` : `/${lang}${path}`;
}

// '/en/a11y' → '/a11y' · '/a11y' → '/a11y'. Inversa di langPath.
export function stripLang(pathname) {
  const m = pathname.match(RE);
  return m ? (m[2] || '/') : pathname;
}

// null se il percorso non ha prefisso (= italiano).
export function langFromPath(pathname) {
  const m = pathname.match(RE);
  return m ? m[1] : null;
}

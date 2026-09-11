// app/sitemap.js — Next 14 serve questo su /sitemap.xml.
// Le rotte sono le stesse di nav.jsx (TOOLS): aggiungere un tool = una riga in ROUTES.
// Da quando middleware.js dà un URL a ogni lingua, ogni rotta esiste in 6 varianti:
// 5 × 6 = 30 URL, ciascuno con il blocco hreflang completo (alternates.languages).
import { LOCALES, langPath } from './locales';

const BASE = 'https://beacon.lucarimediotti.com';

const ROUTES = [
  { path: '/', priority: 1 },
  { path: '/report', priority: 0.9 },
  { path: '/a11y', priority: 0.8 },
  { path: '/perf', priority: 0.8 },
  { path: '/aiact', priority: 0.8 },
];

export default function sitemap() {
  const now = new Date();
  return ROUTES.flatMap(({ path, priority }) => {
    // Stesso set di alternate per tutte le varianti della rotta: è la reciprocità
    // che Google richiede (ogni variante deve elencare anche sé stessa).
    const languages = Object.fromEntries(LOCALES.map((l) => [l, BASE + langPath(l, path)]));
    languages['x-default'] = BASE + langPath('it', path);

    return LOCALES.map((lang) => ({
      url: BASE + langPath(lang, path),
      lastModified: now,
      changeFrequency: 'monthly',
      // Le traduzioni valgono meno dell'originale italiano: -0.1, mai sotto 0.1.
      priority: lang === 'it' ? priority : Math.round((priority - 0.1) * 10) / 10,
      alternates: { languages },
    }));
  });
}

// Aggregatore dizionari. La chiave è la stringa italiana (vedi i18n.jsx).
import { en } from './en';
import { de } from './de';
import { fr } from './fr';
import { es } from './es';
import { pt } from './pt';

export const DICTS = { en, de, fr, es, pt };

// iso = ISO 3166-1 alpha-2 per flag-icons (bandiere SVG). 'en' usa GB.
// Niente emoji-bandiera: Windows non le renderizza (mostra le due lettere).
export const LANGS = [
  { code: 'it', iso: 'it', label: 'Italiano' },
  { code: 'en', iso: 'gb', label: 'English' },
  { code: 'de', iso: 'de', label: 'Deutsch' },
  { code: 'fr', iso: 'fr', label: 'Français' },
  { code: 'es', iso: 'es', label: 'Español' },
  { code: 'pt', iso: 'pt', label: 'Português' },
];

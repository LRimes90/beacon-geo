// Aggregatore dizionari. La chiave è la stringa italiana (vedi i18n.jsx).
import { en } from './en';
import { de } from './de';
import { fr } from './fr';
import { es } from './es';
import { pt } from './pt';

export const DICTS = { en, de, fr, es, pt };

export const LANGS = [
  { code: 'it', flag: '🇮🇹', label: 'Italiano' },
  { code: 'en', flag: '🇬🇧', label: 'English' },
  { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
  { code: 'fr', flag: '🇫🇷', label: 'Français' },
  { code: 'es', flag: '🇪🇸', label: 'Español' },
  { code: 'pt', flag: '🇵🇹', label: 'Português' },
];

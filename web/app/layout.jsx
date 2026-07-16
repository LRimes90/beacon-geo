import './globals.css';
import BackToTop from './back-to-top';
import { LangProvider } from './i18n';

export const metadata = {
  title: 'Beacon — le AI leggono il tuo sito?',
  description: 'Checker gratuito di AI-readiness / GEO: scopri cosa trovano i crawler AI e come migliorare.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body><LangProvider>{children}<BackToTop /></LangProvider></body>
    </html>
  );
}

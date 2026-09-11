import { headers } from 'next/headers';
import 'flag-icons/css/flag-icons.min.css';
import './globals.css';
import BackToTop from './back-to-top';
import { LangProvider } from './i18n';
import { LOCALES, langPath } from './locales';

const SITE = 'https://beacon.lucarimediotti.com';
const TITLE = 'Beacon — le AI leggono il tuo sito?';
const DESC = 'Checker gratuito di AI-readiness / GEO: scopri cosa trovano i crawler AI e come migliorare.';

// Titolo e descrizione per lingua: sono gli unici due testi che devono esistere
// lato server (i dizionari di `translations/` vivono nei client component).
const META = {
  it: [TITLE, DESC],
  en: ['Beacon — do AIs read your site?',
    'Free AI-readiness / GEO checker: see what AI crawlers find on your site and how to improve it.'],
  de: ['Beacon — lesen KI-Systeme deine Website?',
    'Kostenloser AI-Readiness-/GEO-Check: sieh, was KI-Crawler finden, und wie du es verbesserst.'],
  fr: ['Beacon — les IA lisent-elles votre site ?',
    'Test gratuit de lisibilité IA / GEO : découvrez ce que trouvent les crawlers IA et comment progresser.'],
  es: ['Beacon — ¿las IA leen tu sitio?',
    'Comprobador gratuito de AI-readiness / GEO: descubre qué encuentran los rastreadores de IA y cómo mejorar.'],
  pt: ['Beacon — as IA leem o teu site?',
    'Verificador gratuito de AI-readiness / GEO: descobre o que os crawlers de IA encontram e como melhorar.'],
};
const OG_LOCALE = { it: 'it_IT', en: 'en_GB', de: 'de_DE', fr: 'fr_FR', es: 'es_ES', pt: 'pt_PT' };

// Lingua e percorso arrivano da middleware.js. Fallback all'italiano: in `next dev`
// su una rotta non coperta dal matcher gli header non ci sono.
function ctx() {
  const h = headers();
  const lang = h.get('x-beacon-lang') || 'it';
  return { lang: META[lang] ? lang : 'it', path: h.get('x-beacon-path') || '/' };
}

// metadataBase serve a Next per risolvere gli URL relativi di canonical e og:image.
// Senza, `alternates.canonical: '/'` non produce nessun tag.
export async function generateMetadata() {
  const { lang, path } = ctx();
  const [title, description] = META[lang];
  // hreflang reciproco: ogni variante elenca tutte le altre, x-default sull'italiano.
  const languages = Object.fromEntries(LOCALES.map((l) => [l, langPath(l, path)]));
  languages['x-default'] = langPath('it', path);

  return {
    metadataBase: new URL(SITE),
    title,
    description,
    alternates: { canonical: langPath(lang, path), languages },
    openGraph: {
      type: 'website',
      url: SITE + langPath(lang, path),
      siteName: 'Beacon',
      title,
      description,
      locale: OG_LOCALE[lang],
      // Nessun `images` qui: lo fornisce app/opengraph-image.jsx (convenzione file di
      // Next, che popola anche twitter:image). Dichiararlo due volte crea ambiguità.
    },
    twitter: { card: 'summary_large_image', title, description },
    robots: { index: true, follow: true },
  };
}

// JSON-LD: WebSite + Organization descrivono il sito e chi lo pubblica.
// SoftwareApplication descrive il prodotto: è il nodo che i motori generativi
// citano quando qualcuno chiede «uno strumento per…».
const softwareApplication = {
  '@type': 'SoftwareApplication',
  name: 'Beacon',
  description:
    'Suite di audit web gratuita e self-hosted: AI-readiness (GEO), accessibilità WCAG 2.2, ' +
    'performance Core Web Vitals e perimetro AI Act in un unico report. Motore Node a zero dipendenze.',
  // WebApplication: il pubblico che ci arriva usa la UI nel browser. La CLI esiste
  // ma è il canale secondario, e un nodo solo non può dichiarare due categorie.
  applicationCategory: 'WebApplication',
  operatingSystem: 'Any',
  browserRequirements: 'Richiede JavaScript',
  // Omettere offers non dice «gratis», dice «prezzo ignoto»: un motore generativo
  // non può escludere un paywall. price '0' lo dichiara in modo esplicito.
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  license: 'https://opensource.org/licenses/MIT',
  codeRepository: 'https://github.com/LRimes90/beacon-geo',
  inLanguage: ['it', 'en', 'fr', 'de', 'es', 'pt'],
  // Solo i 4 audit che il tool esegue davvero. Il monitoraggio delle citazioni AI
  // reali è fuori scope per scelta: dichiararlo qui sarebbe una promessa falsa.
  featureList: [
    'Audit GEO / AI-readiness: accesso dei crawler AI, file agentici, dati strutturati, leggibilità',
    'Audit di accessibilità WCAG 2.2 basato su axe-core',
    'Audit di performance con Core Web Vitals via PageSpeed Insights',
    'Verifica del perimetro di applicabilità del regolamento UE 2024/1689 (AI Act)',
  ],
  author: { '@id': `${SITE}/#org` },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${SITE}/#website`,
      url: SITE,
      name: 'Beacon',
      description: DESC,
      inLanguage: 'it-IT',
      publisher: { '@id': `${SITE}/#org` },
    },
    {
      '@type': 'Organization',
      '@id': `${SITE}/#org`,
      name: 'Luca Rimediotti',
      url: 'https://lucarimediotti.com/',
      sameAs: ['https://github.com/LRimes90'],
    },
    { '@id': `${SITE}/#app`, url: SITE, ...softwareApplication },
  ],
};

export default function RootLayout({ children }) {
  const { lang } = ctx();
  return (
    <html lang={lang}>
      {/* JSON-LD nel body, non in un <head> manuale: la doc Next sconsiglia di
          scrivere <head> a mano in App Router (interferisce con i metadata). */}
      <body>
        {/* rel="license" non ha un campo nella Metadata API di Next 14: si dichiara qui.
            È il segnale che cerca il check "licenza contenuti" di Beacon stesso. */}
        <link rel="license" href="https://opensource.org/licenses/MIT" />
        <script type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <LangProvider initialLang={lang}>{children}<BackToTop /></LangProvider>
        {/* Footer fuori da LangProvider di proposito: contiene solo nomi propri e
            percorsi di file, quindi non ha nulla da tradurre e resta un Server Component. */}
        <footer className="site-foot">
          <p>Beacon · <a href="https://github.com/LRimes90/beacon-geo">GitHub</a> · MIT ·{' '}
            <a href="https://lucarimediotti.com/">Luca Rimediotti</a></p>
          <p><a href="/llms.txt">llms.txt</a> · <a href="/skill.md">skill.md</a> ·{' '}
            <a href="/sitemap.xml">sitemap.xml</a> · <a href="/robots.txt">robots.txt</a></p>
        </footer>
      </body>
    </html>
  );
}

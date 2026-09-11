// app/robots.txt/route.js — robots.txt scritto a mano, non con la convenzione
// `app/robots.js`: quell'oggetto non ha nessun campo per `Content-Signal:`, che è
// una direttiva testuale (contentsignals.org) e va emessa dentro il gruppo User-Agent.
// Nota storica: finché il file non esisteva, Cloudflare iniettava da sé un blocco di
// commenti Content Signals; da quando l'origin risponde, quel blocco non compare più.
export const dynamic = 'force-static';

const BASE = 'https://beacon.lucarimediotti.com';

// search=yes      → indicizzazione classica e AI Overviews: sì
// ai-input=yes    → uso come fonte citata in risposta (RAG/grounding): sì, è lo scopo del sito
// ai-train=no     → addestramento di modelli sul contenuto: no (coerente con tdmrep.json)
const TXT = `# Beacon — https://beacon.lucarimediotti.com
# Content-Signal: dichiarazione d'uso dei contenuti (https://contentsignals.org).
# Il codice del progetto e' MIT: la riserva riguarda i testi del sito, non il software.
User-Agent: *
Content-Signal: search=yes, ai-input=yes, ai-train=no
Allow: /
Disallow: /api/

Host: ${BASE}
Sitemap: ${BASE}/sitemap.xml
`;

export function GET() {
  return new Response(TXT, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

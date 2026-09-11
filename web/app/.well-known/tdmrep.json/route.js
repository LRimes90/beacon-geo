// app/.well-known/tdmrep.json/route.js — TDM Reservation Protocol (W3C CG).
// `tdm-reservation: 1` = i diritti di text & data mining sui contenuti sono riservati.
// Coerente con `ai-train=no` in robots.txt. Il CODICE resta MIT: la riserva vale per i testi.
export const dynamic = 'force-static';

const BODY = [
  {
    location: '/',
    'tdm-reservation': 1,
    'tdm-policy': 'https://github.com/LRimes90/beacon-geo/blob/main/LICENSE',
  },
];

export function GET() {
  return new Response(JSON.stringify(BODY, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

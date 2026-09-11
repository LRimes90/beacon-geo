// app/.well-known/agent-skills/index.json/route.js — indice delle Agent Skills del sito.
// Una sola skill: quella servita su /skill.md. Se un giorno ce ne fosse più d'una,
// questo array è il punto da estendere (i client leggono l'indice, non indovinano i path).
export const dynamic = 'force-static';

const BASE = 'https://beacon.lucarimediotti.com';

const BODY = {
  version: 1,
  skills: [
    {
      name: 'beacon-web-audit',
      description:
        'Audit di un sito pubblico: AI-readiness (GEO), accessibilità WCAG 2.2, ' +
        'Core Web Vitals e perimetro AI Act. API senza chiave.',
      url: `${BASE}/skill.md`,
      license: 'MIT',
    },
  ],
};

export function GET() {
  return new Response(JSON.stringify(BODY, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

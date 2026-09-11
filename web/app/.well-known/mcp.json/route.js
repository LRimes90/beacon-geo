// app/.well-known/mcp.json/route.js — descrittore di discovery del server MCP.
// Punta a /api/mcp, che esiste davvero: nessun descrittore di server inesistenti.
export const dynamic = 'force-static';

const BASE = 'https://beacon.lucarimediotti.com';

const BODY = {
  schemaVersion: '2025-06-18',
  servers: [
    {
      name: 'beacon',
      description:
        'Audit AI-readiness (GEO) di un sito pubblico: accesso crawler AI, file agentici, ' +
        'dati strutturati, leggibilità. Senza chiave, senza login.',
      url: `${BASE}/api/mcp`,
      transport: 'streamable-http',
      authentication: { type: 'none' },
      tools: ['beacon_audit'],
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

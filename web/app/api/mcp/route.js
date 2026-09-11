// app/api/mcp/route.js — server MCP di Beacon, transport "Streamable HTTP" (solo POST JSON).
// Implementato a mano invece che con l'SDK: servono tre metodi (initialize, tools/list,
// tools/call) e l'SDK porterebbe una dipendenza per ~60 righe di JSON-RPC.
// Niente SSE: nessun tool qui è long-running al punto da servire uno stream.
// ponytail: nessuna sessione (Mcp-Session-Id) — i tool sono stateless, non serve.
import { audit } from 'beacon-geo/audit';
import { rateLimit } from 'beacon-geo/guard';
import { normalizeLang } from 'beacon-geo/messages';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const PROTOCOL = '2025-06-18';

const TOOLS = [
  {
    name: 'beacon_audit',
    description:
      "Analizza un URL pubblico e restituisce l'AI-readiness (GEO): accesso dei crawler AI, " +
      'file agentici, dati strutturati, leggibilità. Ogni check ha un campo `fix` con ' +
      "l'azione concreta. Il punteggio complessivo è `overall` (0-100).",
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL completo da analizzare, con schema https://' },
        lang: { type: 'string', enum: ['it', 'en', 'de', 'fr', 'es', 'pt'], description: 'Lingua dei testi restituiti (default: it)' },
        renderJs: { type: 'boolean', description: 'Renderizza la pagina con un browser prima di analizzarla. Più lento.' },
      },
      required: ['url'],
    },
  },
];

const ok = (id, result) => Response.json({ jsonrpc: '2.0', id, result });
const err = (id, code, message) => Response.json({ jsonrpc: '2.0', id, error: { code, message } });
const text = (id, obj) => ok(id, { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });

export async function POST(req) {
  let rpc;
  try { rpc = await req.json(); } catch { return err(null, -32700, 'Parse error'); }
  const { id = null, method, params = {} } = rpc || {};

  // Le notifiche JSON-RPC non hanno `id` e non vogliono risposta (202 senza corpo).
  if (rpc && rpc.id === undefined) return new Response(null, { status: 202 });

  switch (method) {
    case 'initialize':
      return ok(id, {
        protocolVersion: PROTOCOL,
        capabilities: { tools: {} },
        serverInfo: { name: 'beacon', version: '1.0.0' },
        instructions:
          'Beacon misura le condizioni tecniche perché un sito sia leggibile e citabile ' +
          'dalle AI. Non interroga nessun LLM e non misura citazioni reali.',
      });

    case 'ping':
      return ok(id, {});

    case 'tools/list':
      return ok(id, { tools: TOOLS });

    case 'tools/call': {
      if (params.name !== 'beacon_audit') return err(id, -32602, `Tool sconosciuto: ${params.name}`);
      const a = params.arguments || {};
      if (!a.url || typeof a.url !== 'string') return err(id, -32602, 'Parametro `url` mancante');

      // Stesso rate limit degli endpoint REST (20/min per IP), ma in forma JSON-RPC:
      // un client MCP non sa leggere il 429 HTTP dentro una risposta di tool.
      const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim()
        || req.headers.get('x-real-ip') || 'local';
      if (process.env.RATE_LIMIT_ON) {
        const rl = rateLimit(ip, { limit: Number(process.env.RATE_LIMIT) || 20 });
        if (!rl.ok) return err(id, -32000, `Troppe richieste: riprova fra ${rl.retryAfter} secondi.`);
      }

      try {
        const r = await audit(a.url, { renderJs: !!a.renderJs, lang: normalizeLang(a.lang) });
        const { html, ...rest } = r; // l'HTML grezzo saturerebbe il context del client
        return text(id, rest);
      } catch (e) {
        // isError: il client mostra il messaggio al modello invece di interrompere la sessione.
        return ok(id, { isError: true, content: [{ type: 'text', text: `Audit fallito: ${String(e.message || e).slice(0, 200)}` }] });
      }
    }

    default:
      return err(id, -32601, `Metodo non supportato: ${method}`);
  }
}

// GET senza SSE: dichiaralo esplicitamente, così un client non resta appeso in attesa.
export function GET() {
  return new Response('Method Not Allowed: questo server MCP accetta solo POST JSON-RPC.', {
    status: 405,
    headers: { Allow: 'POST', 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

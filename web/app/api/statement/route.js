// app/api/statement/route.js — genera la bozza di dichiarazione dai dati già scansionati.
// Non ri-scansiona: riceve il risultato dell'audit a11y che il client ha in mano.
import { generateStatement } from 'beacon-geo/statement';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON non valido' }, { status: 400 }); }
  const { audit, org, contact } = body || {};
  if (!audit || !audit.host) return Response.json({ error: 'Dati audit mancanti' }, { status: 400 });
  const date = new Date().toISOString().slice(0, 10);
  const md = generateStatement(audit, { org, contact, date });
  return new Response(md, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
}

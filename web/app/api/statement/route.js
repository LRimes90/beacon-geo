// app/api/statement/route.js — genera la bozza di dichiarazione dai dati già scansionati.
// Non ri-scansiona: riceve il risultato dell'audit a11y che il client ha in mano.
// i18n (fase 2): VOLUTAMENTE senza `lang`. La dichiarazione è un documento legale
// ancorato alla normativa italiana/UE (Legge Stanca, EAA): tradurne il template
// richiede revisione giuridica per paese, non una traduzione meccanica → fase 3.
// NB: le criticità elencate arrivano dall'audit del client e sono già nella lingua della scansione.
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

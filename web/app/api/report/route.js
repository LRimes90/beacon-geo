// app/api/report/route.js — genera il report cliente-ready dai dati già scansionati.
// format: 'md' | 'html' | 'pdf'. Il PDF usa Playwright (renderPdfBuffer).
import { toHtmlSuite, toMarkdownSuite } from 'beacon-geo/suite-report';
import { renderPdfBuffer } from 'beacon-geo/render';
import { guard } from 'beacon-geo/guard';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON non valido' }, { status: 400 }); }
  const { suite, format = 'html' } = body || {};
  if (!suite || !suite.host) return Response.json({ error: 'Dati scansione mancanti' }, { status: 400 });
  const blocked = await guard(req, body); if (blocked) return blocked;
  const date = new Date().toISOString().slice(0, 10);
  const base = (suite.host || 'sito').replace(/[^a-z0-9.-]/gi, '_');

  if (format === 'md') {
    return new Response(toMarkdownSuite(suite, { date }), {
      headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="beacon-${base}.md"` },
    });
  }
  const html = toHtmlSuite(suite, { date });
  if (format === 'pdf') {
    const r = await renderPdfBuffer(html);
    if (!r.ok) return Response.json({ error: 'PDF non generato: ' + r.reason }, { status: 500 });
    return new Response(r.buffer, {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="beacon-${base}.pdf"` },
    });
  }
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': `attachment; filename="beacon-${base}.html"` },
  });
}

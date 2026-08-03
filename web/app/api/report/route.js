// app/api/report/route.js — genera il report cliente-ready dai dati già scansionati.
// format: 'md' | 'html' | 'pdf'. Il PDF usa Playwright (renderPdfBuffer).
import { toHtmlSuite, toMarkdownSuite } from 'beacon-geo/suite-report';
import { renderPdfBuffer } from 'beacon-geo/render';
import { guard } from 'beacon-geo/guard';
import { normalizeLang } from 'beacon-geo/messages';
import { reqLang, fail } from '../http.js';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return fail(reqLang(req), 'api.badJson', 400); }
  const { suite, format = 'html', lang } = body || {};
  // `host` stringa non è pignoleria: sotto viene usato per il nome del file
  // (.replace) e dai generatori. Con un numero la route usciva in 500 vuoto.
  if (!suite || typeof suite !== 'object' || Array.isArray(suite) || typeof suite.host !== 'string' || !suite.host) {
    return fail(reqLang(req, body), 'api.suiteMissing', 400);
  }
  const blocked = await guard(req, body); if (blocked) return blocked;
  const date = new Date().toISOString().slice(0, 10);
  const base = suite.host.replace(/[^a-z0-9.-]/gi, '_');
  // lang: preferisci quella della scansione (il contenuto dei check è già in quella lingua),
  // poi quella richiesta dal client; whitelist it/en/de/fr/es/pt.
  const L = normalizeLang(suite.lang || lang);

  // try/catch: i generatori navigano la struttura della scansione. Un `suite`
  // incompleto (sezione troncata, campo del tipo sbagliato) lanciava e la route
  // rispondeva 500 con corpo VUOTO — il frontend non aveva nemmeno un messaggio.
  try {
    if (format === 'md') {
      return new Response(toMarkdownSuite(suite, { date, lang: L }), {
        headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="beacon-${base}.md"` },
      });
    }
    const html = toHtmlSuite(suite, { date, lang: L });
    if (format === 'pdf') {
      const r = await renderPdfBuffer(html);
      // Il motivo tecnico (Playwright assente, timeout del browser) va nei log:
      // all'utente serve sapere che c'è l'alternativa HTML, non quale libreria manca.
      if (!r.ok) { console.error('[api/report] PDF:', r.reason); return fail(L, 'api.pdfFailed', 500); }
      return new Response(r.buffer, {
        headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="beacon-${base}.pdf"` },
      });
    }
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': `attachment; filename="beacon-${base}.html"` },
    });
  } catch (e) {
    console.error('[api/report]', e);
    return fail(L, 'api.reportIncomplete', 400);
  }
}

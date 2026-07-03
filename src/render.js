// src/render.js — rendering JS OPZIONALE via Playwright (import dinamico).
// Se 'playwright' non è installato, ritorna { ok:false }: l'analisi procede in modalità no-JS.
// Attivazione:  npm i playwright  (poi:  node audit.js <url> --js)

export async function renderHtml(url, { timeout = 20000, ua } = {}) {
  let pw;
  try {
    pw = await import(/* webpackIgnore: true */ 'playwright'); // dipendenza opzionale
  } catch {
    return { ok: false, reason: 'playwright non installato — esegui: npm i playwright' };
  }
  let browser;
  try {
    browser = await pw.chromium.launch({ headless: true });
    const ctx = await browser.newContext(ua ? { userAgent: ua } : {});
    const page = await ctx.newPage();
    // networkidle = aspetta che la SPA finisca di idratare/caricare i contenuti
    await page.goto(url, { waitUntil: 'networkidle', timeout });
    const html = await page.content();
    return { ok: true, html };
  } catch (e) {
    return { ok: false, reason: String(e).slice(0, 100) };
  } finally {
    if (browser) await browser.close();
  }
}

// Converte HTML in PDF (opzionale, via Playwright). Fallback graceful come renderHtml.
export async function htmlToPdf(html, outPath, { format = 'A4' } = {}) {
  let pw;
  try { pw = await import(/* webpackIgnore: true */ 'playwright'); } catch { return { ok: false, reason: 'playwright non installato — esegui: npm i playwright' }; }
  let browser;
  try {
    browser = await pw.chromium.launch({ headless: true });
    const page = await (await browser.newContext()).newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.pdf({ path: outPath, format, printBackground: true });
    return { ok: true, path: outPath };
  } catch (e) {
    return { ok: false, reason: String(e).slice(0, 100) };
  } finally {
    if (browser) await browser.close();
  }
}

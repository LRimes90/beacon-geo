// src/seoTech.js — controlli SEO tecnici B1-B4 come FUNZIONI PURE (niente rete qui).
// Input già raccolto da audit.js; ritorna un array di check {name, status, detail, fix}
// nello stesso formato di analyzeTech. Un controllo senza dati sufficienti (es. header
// su uno snapshot HTML) viene OMESSO, mai inventato.
// Riferimenti: Google Search Central (robots meta/X-Robots-Tag, canonical, hreflang,
// dati strutturati), skill schema (proprietà obbligatorie), RFC 6797 (HSTS).
import { makeT } from './messages/index.js';
import { getMeta, parseRobots, tagAttrs, jsonLdBlocks } from './lib.js';
export const linksByRel = (html, rel) =>
  tagAttrs(html, 'link').filter((a) => (a.rel || '').toLowerCase().split(/\s+/).includes(rel));

// URL → forma confrontabile: schema+host minuscoli, path senza slash finale, niente #hash.
export function normCmp(u) {
  try {
    const x = new URL(u);
    return x.protocol + '//' + x.host.toLowerCase() + x.pathname.replace(/\/+$/, '') + x.search;
  } catch { return null; }
}

// Header → { get(nome) } (accetta Headers nativo, oggetto semplice o null).
export function headerMap(h) {
  if (!h) return null;
  if (typeof h.get === 'function') return h;
  const lo = Object.fromEntries(Object.entries(h).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (k) => lo[k.toLowerCase()] ?? null };
}

// B1 — direttive robots: noindex/nofollow da header X-Robots-Tag e meta nofollow.
// Conta solo le direttive globali o riferite a Googlebot/bingbot ("otherbot: noindex" no).
export function robotsDirectives(headers, html) {
  const val = headers ? (headers.get('x-robots-tag') || '') : '';
  const parts = val.split(',').map((s) => s.trim().toLowerCase());
  const mine = (d) => parts.some((p) => p === d || (/^(googlebot|bingbot|\*):\s*/.test(p) && p.replace(/^[^:]+:\s*/, '').split(/\s+/).includes(d)));
  const metaRobots = tagAttrs(html, 'meta')
    .filter((a) => /^(robots|googlebot)$/i.test(a.name || ''))
    .map((a) => (a.content || '').toLowerCase()).join(',');
  return {
    headerNoindex: mine('noindex') || mine('none'),
    headerNofollow: mine('nofollow') || mine('none'),
    metaNofollow: /(^|[\s,])(nofollow|none)([\s,]|$)/.test(metaRobots),
  };
}

// B1 — robots.txt: blocco totale, blocco Googlebot, numero di righe Sitemap.
export function robotsBlocking(robotsTxt) {
  const r = parseRobots(robotsTxt);
  const all = !r.isAllowed('*', '/');
  const google = !all && !r.isAllowed('Googlebot', '/');
  return { all, google, sitemaps: r.sitemaps.length };
}

// B2 — canonical: stato rispetto all'URL finale.
export function canonicalState(html, finalUrl) {
  const c = linksByRel(html, 'canonical');
  if (!c.length) return { state: 'none' };
  if (c.length > 1) return { state: 'multi', count: c.length };
  const href = (c[0].href || '').trim();
  if (!/^https?:\/\//i.test(href)) return { state: 'relative', href };
  let a, b;
  try { a = new URL(href); b = new URL(finalUrl); } catch { return { state: 'relative', href }; }
  if (a.host.toLowerCase() !== b.host.toLowerCase()) return { state: 'host', href };
  if (normCmp(href) !== normCmp(finalUrl)) return { state: 'elsewhere', href };
  return { state: 'ok', href };
}

// B2 — hreflang: codici BCP47 semplificati (lingua[-Script][-REGIONE]) + x-default.
const HREFLANG_RE = /^(x-default|[a-z]{2,3}(-[A-Za-z]{4})?(-([A-Za-z]{2}|\d{3}))?)$/;
export function hreflangState(html, finalUrl) {
  const alts = linksByRel(html, 'alternate').filter((a) => a.hreflang);
  if (!alts.length) return null;
  const codes = alts.map((a) => a.hreflang.trim());
  const self = normCmp(finalUrl);
  return {
    count: alts.length,
    invalid: codes.filter((c) => !HREFLANG_RE.test(c)),
    noDefault: !codes.some((c) => c.toLowerCase() === 'x-default'),
    noSelf: !alts.some((a) => {
      try { return normCmp(new URL(a.href, finalUrl).href) === self; } catch { return false; }
    }),
  };
}

// B3 — header di sicurezza. HSTS ha senso solo su https.
export function securityHeaders(headers, isHttps) {
  const has = {
    HSTS: !!headers.get('strict-transport-security'),
    CSP: !!headers.get('content-security-policy'),
    'X-Content-Type-Options': /nosniff/i.test(headers.get('x-content-type-options') || ''),
    'Referrer-Policy': !!headers.get('referrer-policy'),
  };
  const names = Object.keys(has).filter((k) => isHttps || k !== 'HSTS');
  return { total: names.length, missing: names.filter((k) => !has[k]) };
}

// B4 — blocchi JSON-LD: errori di sintassi e proprietà obbligatorie dei tipi comuni.
// shortcut: i sottotipi (Dentist, Restaurant… sotto LocalBusiness) non sono mappati e
// si controllano solo i nodi di primo livello (root e @graph): i nodi annidati
// (publisher, author) sono spesso parziali per scelta e darebbero falsi allarmi.
export const REQUIRED_PROPS = {
  Organization: ['name', 'url'], WebSite: ['name', 'url'],
  Article: ['headline', 'image', 'datePublished', 'author'],
  BlogPosting: ['headline', 'image', 'datePublished', 'author'],
  NewsArticle: ['headline', 'image', 'datePublished', 'author'],
  Product: ['name', 'image', 'offers'], SoftwareApplication: ['name', 'offers'],
  FAQPage: ['mainEntity'], HowTo: ['name', 'step'], BreadcrumbList: ['itemListElement'],
  LocalBusiness: ['name', 'address'], Event: ['name', 'startDate', 'location'],
};
export function jsonLdState(html) {
  let bad = 0, count = 0;
  const problems = [], types = new Set();
  for (const raw of jsonLdBlocks(html)) {
    count++;
    let data;
    try { data = JSON.parse(raw.trim()); } catch { bad++; continue; }
    const nodes = [].concat(data).flatMap((r) => (r && Array.isArray(r['@graph']) ? r['@graph'] : [r]));
    for (const n of nodes) {
      if (!n || typeof n !== 'object') continue;
      for (const ty of [].concat(n['@type'] || [])) {
        const req = REQUIRED_PROPS[ty];
        if (!req) continue;
        types.add(ty);
        const miss = req.filter((p) => n[p] == null || n[p] === '' || (Array.isArray(n[p]) && !n[p].length));
        if (miss.length) problems.push(ty + ': ' + miss.join(', '));
      }
    }
  }
  return { count, bad, problems, types: [...types] };
}

// B4 — Open Graph completo (og:image:alt solo consigliato).
export function ogState(html) {
  const missing = ['og:title', 'og:description', 'og:image', 'og:url'].filter((k) => !(getMeta(html, k) || '').trim());
  return { missing, altMissing: !(getMeta(html, 'og:image:alt') || '').trim() };
}

// Costruisce i check. inp = { html, headers|null, finalUrl, robotsOk, robotsTxt,
// probes: { http, www, chain } | null }. Dati assenti = controllo omesso.
export function analyzeSeoChecks(inp, lang = 'it') {
  const t = makeT(lang);
  const { html = '', finalUrl, robotsOk, robotsTxt = '', probes } = inp;
  const headers = headerMap(inp.headers);
  const checks = [];

  // B1 — direttive robots
  const d = robotsDirectives(headers, html);
  const nof = d.headerNofollow || d.metaNofollow;
  checks.push({ name: t('tech.directives.name'),
    status: d.headerNoindex ? 'crit' : nof ? 'warn' : 'good',
    detail: d.headerNoindex ? t('tech.directives.detail.noindex')
      : nof ? t('tech.directives.detail.nofollow', { where: d.headerNofollow ? 'X-Robots-Tag' : 'meta robots' })
      : t('tech.directives.detail.ok'),
    fix: d.headerNoindex || nof ? t('tech.directives.fix') : null });
  if (robotsOk) {
    const b = robotsBlocking(robotsTxt);
    const blocked = b.all || b.google;
    checks.push({ name: t('tech.robotsBlock.name'), status: blocked ? 'crit' : 'good',
      detail: b.all ? t('tech.robotsBlock.detail.all') : b.google ? t('tech.robotsBlock.detail.google') : t('tech.robotsBlock.detail.ok'),
      fix: blocked ? t('tech.robotsBlock.fix') : null });
    checks.push({ name: t('tech.sitemapLine.name'), status: b.sitemaps ? 'good' : 'warn',
      detail: b.sitemaps ? t('tech.sitemapLine.detail.ok', { count: b.sitemaps }) : t('tech.sitemapLine.detail.no'),
      fix: b.sitemaps ? null : t('tech.sitemapLine.fix') });
  } else {
    checks.push({ name: t('tech.robotsBlock.name'), status: 'info', detail: t('tech.robotsBlock.detail.none'), fix: null });
  }

  // B2 — canonical e hreflang
  const c = canonicalState(html, finalUrl);
  checks.push({ name: t('tech.canonical.name'), status: c.state === 'ok' ? 'good' : 'warn',
    detail: t('tech.canonical.detail.' + c.state, { href: c.href || '', count: c.count || 0 }),
    fix: c.state === 'ok' ? null : t('tech.canonical.fix') });
  const h = hreflangState(html, finalUrl);
  if (h) {
    const issues = [];
    if (h.invalid.length) issues.push(t('tech.hreflang.i.invalid', { codes: h.invalid.slice(0, 4).join(', ') }));
    if (h.noDefault) issues.push(t('tech.hreflang.i.noDefault'));
    if (h.noSelf) issues.push(t('tech.hreflang.i.noSelf'));
    checks.push({ name: t('tech.hreflang.name'), status: issues.length ? 'warn' : 'good',
      detail: issues.length ? t('tech.hreflang.detail.issues', { list: issues.join('; ') }) : t('tech.hreflang.detail.ok', { count: h.count }),
      fix: issues.length ? t('tech.hreflang.fix') : null });
  }

  // B3 — redirect (sonde di rete) e header di sicurezza
  if (probes) {
    const p = probes.http;
    if (p) {
      const k = !p.ok ? 'unreachable' : p.finalUrl.startsWith('https://') ? 'ok' : 'no';
      checks.push({ name: t('tech.httpRedirect.name'), status: k === 'ok' ? 'good' : k === 'no' ? 'crit' : 'info',
        detail: t('tech.httpRedirect.detail.' + k), fix: k === 'no' ? t('tech.httpRedirect.fix') : null });
    }
    if (probes.chain) {
      const hops = probes.chain.hops.length;
      const path = [...probes.chain.hops.map((x) => x.url), probes.chain.finalUrl].join(' → ');
      checks.push({ name: t('tech.chain.name'), status: hops > 1 ? 'warn' : 'good',
        detail: hops > 1 ? t('tech.chain.detail.long', { hops, path }) : t('tech.chain.detail.ok', { hops }),
        fix: hops > 1 ? t('tech.chain.fix') : null });
    }
    const w = probes.www;
    if (w) {
      const same = w.ok && new URL(w.finalUrl).host.toLowerCase() === new URL(finalUrl).host.toLowerCase();
      const k = !w.ok ? 'none' : same ? 'ok' : 'dup';
      checks.push({ name: t('tech.www.name'), status: k === 'ok' ? 'good' : k === 'dup' ? 'warn' : 'info',
        detail: t('tech.www.detail.' + k, { variant: w.variant }), fix: k === 'dup' ? t('tech.www.fix') : null });
    }
  }
  if (headers) {
    const s = securityHeaders(headers, finalUrl.startsWith('https://'));
    const miss = s.missing.length;
    checks.push({ name: t('tech.headers.name'), status: miss ? 'warn' : 'good',
      detail: miss ? t('tech.headers.detail.missing', { have: s.total - miss, total: s.total, missing: s.missing.join(', ') }) : t('tech.headers.detail.ok'),
      fix: miss ? t('tech.headers.fix') : null });
  }

  // B4 — dati strutturati e Open Graph
  const j = jsonLdState(html);
  if (j.count) {
    checks.push({ name: t('tech.jsonldSyntax.name'), status: j.bad ? 'crit' : 'good',
      detail: j.bad ? t('tech.jsonldSyntax.detail.bad', { bad: j.bad, count: j.count }) : t('tech.jsonldSyntax.detail.ok', { count: j.count }),
      fix: j.bad ? t('tech.jsonldSyntax.fix') : null });
  }
  if (j.types.length) {
    checks.push({ name: t('tech.jsonldProps.name'), status: j.problems.length ? 'warn' : 'good',
      detail: j.problems.length ? t('tech.jsonldProps.detail.missing', { list: j.problems.slice(0, 4).join(' | ') }) : t('tech.jsonldProps.detail.ok', { types: j.types.join(', ') }),
      fix: j.problems.length ? t('tech.jsonldProps.fix') : null });
  }
  const o = ogState(html);
  checks.push({ name: t('tech.og.name'), status: o.missing.length ? 'warn' : o.altMissing ? 'info' : 'good',
    detail: o.missing.length ? t('tech.og.detail.missing', { missing: o.missing.join(', ') }) : o.altMissing ? t('tech.og.detail.alt') : t('tech.og.detail.ok'),
    fix: o.missing.length ? t('tech.og.fix') : o.altMissing ? t('tech.og.fixAlt') : null });

  return checks;
}

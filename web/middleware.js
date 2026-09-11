// middleware.js — dà un URL a ogni lingua senza duplicare le pagine.
// `/en/a11y` viene RISCRITTO (non redirezionato) su `/a11y`: l'utente e i crawler
// vedono sei URL distinti, il filesystem ne ha uno solo. L'italiano resta senza
// prefisso, così gli URL già indicizzati non cambiano.
//
// La lingua viaggia in un header di richiesta, non in un cookie: il cookie `lr_lang`
// è condiviso con lucarimediotti.com e rappresenta la PREFERENZA dell'utente, mentre
// qui serve la lingua di QUESTA pagina. Confonderli significa servire a Googlebot
// una lingua che dipende dall'ultima visita di qualcun altro.
import { NextResponse } from 'next/server';
import { langFromPath, stripLang } from './app/locales';

export function middleware(req) {
  const lang = langFromPath(req.nextUrl.pathname);
  const path = stripLang(req.nextUrl.pathname); // percorso senza prefisso: serve per hreflang

  const headers = new Headers(req.headers);
  headers.set('x-beacon-lang', lang || 'it');
  headers.set('x-beacon-path', path);

  if (!lang) return NextResponse.next({ request: { headers } });

  const url = req.nextUrl.clone();
  url.pathname = path;
  return NextResponse.rewrite(url, { request: { headers } });
}

// Esclude _next, /api e qualunque percorso con un punto (llms.txt, skill.md,
// /.well-known/*, immagini): quei file non hanno varianti di lingua.
export const config = {
  matcher: ['/((?!_next/|api/|.*\\.).*)'],
};

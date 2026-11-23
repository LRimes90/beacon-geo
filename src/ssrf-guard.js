// src/ssrf-guard.js — difesa SSRF per il fetcher.
// Beacon scarica URL forniti dall'utente: senza controlli, il server può essere
// spinto a bussare a risorse INTERNE (loopback, IP privati, link-local, metadata
// cloud). Qui: valida schema http(s), risolve il DNS e blocca gli IP interni PRIMA
// di ogni connessione, e segue i redirect MANUALMENTE ri-validando ogni hop
// (un URL pubblico che risponde 30x→127.0.0.1 non deve passare).
import { lookup } from 'node:dns/promises';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import zlib from 'node:zlib';
import { Readable, pipeline } from 'node:stream';

// Oltre al messaggio, l'errore porta un `code` e il `detail` che lo ha causato
// (host, IP, schema). Il messaggio serve ai log e alla CLI e resta in italiano;
// il code serve a chi parla con l'utente, che lo traduce nella sua lingua —
// senza, un utente inglese leggerebbe «That address cannot be scanned: IP
// interno non consentito». Il guard NON importa l'i18n di proposito: è il
// modulo di sicurezza più basso, non deve dipendere da un catalogo di testi.
export class SsrfError extends Error {
  constructor(msg, code, detail) {
    super(msg);
    this.name = 'SsrfError';
    this.code = code;
    if (detail !== undefined) this.detail = String(detail);
  }
}

const MAX_BYTES = 3_000_000; // ~3 MB: oltre, la risorsa non ci serve (evita OOM)

// --- Blocklist IP (SSRF) ---
function ipv4ToInt(ip) {
  const p = ip.split('.').map(Number);
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}
function inV4Range(ip, base, bits) {
  const shift = 32 - bits;
  return (ipv4ToInt(ip) >>> shift) === (ipv4ToInt(base) >>> shift);
}
function isBlockedIPv4(ip) {
  return (
    inV4Range(ip, '0.0.0.0', 8) ||      // "questa" rete
    inV4Range(ip, '10.0.0.0', 8) ||     // privata
    inV4Range(ip, '100.64.0.0', 10) ||  // CGNAT
    inV4Range(ip, '127.0.0.0', 8) ||    // loopback
    inV4Range(ip, '169.254.0.0', 16) || // link-local (incl. metadata 169.254.169.254)
    inV4Range(ip, '172.16.0.0', 12) ||  // privata
    inV4Range(ip, '192.168.0.0', 16) || // privata
    inV4Range(ip, '192.0.0.0', 24) ||   // IETF protocol assignments
    inV4Range(ip, '198.18.0.0', 15)     // benchmarking
  );
}
function isBlockedIPv6(ip) {
  const s = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (s === '::1' || s === '::') return true;               // loopback / non specificato
  if (s.startsWith('fe80') || s.startsWith('fe9') || s.startsWith('fea') || s.startsWith('feb')) return true; // link-local
  if (s.startsWith('fc') || s.startsWith('fd')) return true; // ULA (private)
  if (s.startsWith('::ffff:')) {                             // IPv4-mapped → valida l'IPv4
    const v4 = s.slice(s.lastIndexOf(':') + 1);
    if (net.isIPv4(v4)) return isBlockedIPv4(v4);
  }
  return false;
}
export function isBlockedIp(ip) {
  if (net.isIPv4(ip)) return isBlockedIPv4(ip);
  if (net.isIPv6(ip)) return isBlockedIPv6(ip);
  return true; // formato ignoto → blocca per sicurezza
}

// Resolver di default (tutti gli indirizzi). Sostituibile SOLO nei test.
let resolveAll = (host) => lookup(host, { all: true });
export function __setResolverForTests(fn) { resolveAll = fn || ((host) => lookup(host, { all: true })); }

// Lookup da passare a http(s).request: la risoluzione DNS avviene DENTRO la
// connessione, quindi l'IP controllato è lo stesso a cui ci si connette (niente
// finestra per il DNS rebinding). Blocca se UNO qualsiasi degli indirizzi è interno.
// `resolve(host)` → Promise<[{address, family}]>.
export function makeSafeLookup(resolve = (h) => resolveAll(h)) {
  return (host, opts, cb) => {
    if (typeof opts === 'function') { cb = opts; opts = {}; }
    resolve(host).then((addrs) => {
      if (!addrs.length) throw new SsrfError('DNS senza risultati: ' + host, 'ssrf.dnsEmpty', host);
      for (const a of addrs) {
        if (isBlockedIp(a.address)) {
          throw new SsrfError('Host risolve a IP interno: ' + host + ' → ' + a.address, 'ssrf.resolvesInternal', host + ' → ' + a.address);
        }
      }
      // Node 20+ (autoSelectFamily) chiama con opts.all e vuole l'array
      if (opts && opts.all) cb(null, addrs.map((a) => ({ address: a.address, family: a.family })));
      else cb(null, addrs[0].address, addrs[0].family);
    }).catch((e) => cb(e instanceof SsrfError ? e : new SsrfError('DNS irrisolvibile: ' + host, 'ssrf.dnsFail', host)));
  };
}

// Valida schema + host, risolve il DNS e verifica TUTTI gli IP restituiti.
// Ritorna l'URL parsato o lancia SsrfError.
export async function assertSafeUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new SsrfError('URL non valido', 'ssrf.badUrl'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new SsrfError('Schema non consentito: ' + u.protocol, 'ssrf.scheme', u.protocol);
  }
  const host = u.hostname;
  if (!host) throw new SsrfError('Host mancante', 'ssrf.noHost');

  if (net.isIP(host)) {
    if (isBlockedIp(host)) throw new SsrfError('IP interno non consentito: ' + host, 'ssrf.internalIp', host);
    return u;
  }
  // Nomi interni per convenzione
  if (/^(localhost|localhost\.localdomain)$/i.test(host) ||
      /\.(localhost|local|internal|intranet|lan|home)$/i.test(host)) {
    throw new SsrfError('Host interno non consentito: ' + host, 'ssrf.internalHost', host);
  }
  let addrs;
  try { addrs = await resolveAll(host); }
  catch { throw new SsrfError('DNS irrisolvibile: ' + host, 'ssrf.dnsFail', host); }
  if (!addrs.length) throw new SsrfError('DNS senza risultati: ' + host, 'ssrf.dnsEmpty', host);
  for (const a of addrs) {
    if (isBlockedIp(a.address)) {
      throw new SsrfError('Host risolve a IP interno: ' + host + ' → ' + a.address, 'ssrf.resolvesInternal', host + ' → ' + a.address);
    }
  }
  return u;
}

// Sostituto di fetch che fissa l'IP: usa node:http(s) con il lookup sicuro e
// l'hostname originale (SNI, certificato e Host restano quelli del sito).
// Non segue mai i redirect (lo fa safeFetch). `init._lookup` = solo test.
const NULL_BODY = new Set([204, 205, 304]);
export function pinnedFetch(url, init = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = {};
    new Headers(init.headers || {}).forEach((v, k) => { headers[k] = v; });
    if (!headers['accept-encoding']) headers['accept-encoding'] = 'gzip, deflate, br';
    const mod = u.protocol === 'https:' ? https : http;
    const method = (init.method || 'GET').toUpperCase();
    const req = mod.request(u, { method, headers, lookup: init._lookup || makeSafeLookup(), signal: init.signal }, (inc) => {
      const status = inc.statusCode;
      if (status < 200 || status > 599) { inc.resume(); return reject(new Error('Status HTTP non gestito: ' + status)); }
      const h = new Headers();
      for (let i = 0; i < inc.rawHeaders.length; i += 2) {
        try { h.append(inc.rawHeaders[i], inc.rawHeaders[i + 1]); } catch { /* header malformato: ignorato */ }
      }
      if (method === 'HEAD' || NULL_BODY.has(status)) {
        inc.resume();
        return resolve(new Response(null, { status, statusText: inc.statusMessage, headers: h }));
      }
      const enc = String(inc.headers['content-encoding'] || '').toLowerCase().trim();
      let stream = inc;
      const dec = enc === 'gzip' || enc === 'x-gzip' ? zlib.createGunzip()
        : enc === 'deflate' ? zlib.createInflate()
        : enc === 'br' ? zlib.createBrotliDecompress() : null;
      if (dec) {
        // pipeline: se lo stream decompresso viene annullato/distrutto, distrugge anche inc (e il socket)
        stream = pipeline(inc, dec, () => {});
        h.delete('content-encoding'); h.delete('content-length');
      }
      resolve(new Response(Readable.toWeb(stream), { status, statusText: inc.statusMessage, headers: h }));
    });
    // timeout di inattività del socket (il `signal` del chiamante resta il tetto complessivo)
    req.setTimeout(30_000, () => req.destroy(new Error('Timeout socket')));
    req.on('error', reject);
    req.end(init.body ?? undefined);
  });
}

// fetch con redirect MANUALE: valida l'URL a ogni hop (il front-door check da solo
// non basta — un 30x verso l'interno lo bypasserebbe).
export async function safeFetch(url, { maxRedirects = 5, ...init } = {}) {
  let current = url;
  for (let i = 0; i <= maxRedirects; i++) {
    await assertSafeUrl(current);
    const res = await pinnedFetch(current, { ...init, redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return { res, finalUrl: current };
      current = new URL(loc, current).href;
      try { await res.body?.cancel(); } catch {} // libera il socket prima di seguire il redirect
      continue;
    }
    return { res, finalUrl: current };
  }
  throw new SsrfError('Troppi redirect', 'ssrf.redirects');
}

// Legge il body con un TETTO sui byte (evita che una risorsa enorme esaurisca la RAM).
export async function readCapped(res, maxBytes = MAX_BYTES) {
  const len = Number(res.headers.get('content-length') || 0);
  if (len && len > maxBytes) return ''; // dichiarata troppo grande: non la scarichiamo
  const reader = res.body?.getReader?.();
  if (!reader) {
    const t = await res.text();
    return t.length > maxBytes ? t.slice(0, maxBytes) : t;
  }
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) { try { await reader.cancel(); } catch {} break; }
    chunks.push(value);
  }
  const buf = new Uint8Array(total > maxBytes ? maxBytes : total);
  let off = 0;
  for (const c of chunks) { if (off + c.length > buf.length) break; buf.set(c, off); off += c.length; }
  return new TextDecoder('utf-8').decode(buf);
}

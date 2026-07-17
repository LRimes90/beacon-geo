// src/ssrf-guard.js — difesa SSRF per il fetcher.
// Beacon scarica URL forniti dall'utente: senza controlli, il server può essere
// spinto a bussare a risorse INTERNE (loopback, IP privati, link-local, metadata
// cloud). Qui: valida schema http(s), risolve il DNS e blocca gli IP interni PRIMA
// di ogni connessione, e segue i redirect MANUALMENTE ri-validando ogni hop
// (un URL pubblico che risponde 30x→127.0.0.1 non deve passare).
import { lookup } from 'node:dns/promises';
import net from 'node:net';

export class SsrfError extends Error {
  constructor(msg) { super(msg); this.name = 'SsrfError'; }
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

// Valida schema + host, risolve il DNS e verifica TUTTI gli IP restituiti.
// Ritorna l'URL parsato o lancia SsrfError.
export async function assertSafeUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new SsrfError('URL non valido'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new SsrfError('Schema non consentito: ' + u.protocol);
  }
  const host = u.hostname;
  if (!host) throw new SsrfError('Host mancante');

  if (net.isIP(host)) {
    if (isBlockedIp(host)) throw new SsrfError('IP interno non consentito: ' + host);
    return u;
  }
  // Nomi interni per convenzione
  if (/^(localhost|localhost\.localdomain)$/i.test(host) ||
      /\.(localhost|local|internal|intranet|lan|home)$/i.test(host)) {
    throw new SsrfError('Host interno non consentito: ' + host);
  }
  let addrs;
  try { addrs = await lookup(host, { all: true }); }
  catch { throw new SsrfError('DNS irrisolvibile: ' + host); }
  if (!addrs.length) throw new SsrfError('DNS senza risultati: ' + host);
  for (const a of addrs) {
    if (isBlockedIp(a.address)) {
      throw new SsrfError('Host risolve a IP interno: ' + host + ' → ' + a.address);
    }
  }
  return u;
}

// fetch con redirect MANUALE: valida l'URL a ogni hop (il front-door check da solo
// non basta — un 30x verso l'interno lo bypasserebbe).
export async function safeFetch(url, { maxRedirects = 5, ...init } = {}) {
  let current = url;
  for (let i = 0; i <= maxRedirects; i++) {
    await assertSafeUrl(current);
    const res = await fetch(current, { ...init, redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return { res, finalUrl: current };
      current = new URL(loc, current).href;
      continue;
    }
    return { res, finalUrl: current };
  }
  throw new SsrfError('Troppi redirect');
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

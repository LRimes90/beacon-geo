'use client';
import { useEffect, useRef } from 'react';

// Widget Cloudflare Turnstile. INERTE senza sitekey: se NEXT_PUBLIC_TURNSTILE_SITEKEY
// non è impostata non renderizza nulla e non carica alcuno script → nessun token,
// e il server (guard.js) salta la verifica. Al deploy basta impostare l'env.
const SITEKEY = process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY;

export default function Turnstile({ onToken }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!SITEKEY) return;
    const id = 'cf-turnstile-script';
    if (!document.getElementById(id)) {
      const s = document.createElement('script');
      s.id = id;
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      s.async = true; s.defer = true;
      document.head.appendChild(s);
    }
    const iv = setInterval(() => {
      if (window.turnstile && ref.current && !ref.current.dataset.rendered) {
        ref.current.dataset.rendered = '1';
        window.turnstile.render(ref.current, { sitekey: SITEKEY, callback: (t) => onToken && onToken(t) });
        clearInterval(iv);
      }
    }, 200);
    return () => clearInterval(iv);
  }, [onToken]);

  if (!SITEKEY) return null;
  return <div ref={ref} className="cf-turnstile" style={{ marginTop: 12 }} />;
}

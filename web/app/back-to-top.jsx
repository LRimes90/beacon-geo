'use client';
import { useEffect, useState } from 'react';

// Back-to-top come su lucarimediotti.com: appare dopo 400px di scroll,
// riporta in cima con scroll fluido. Montato in layout.jsx → tutte le pagine.
export default function BackToTop() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const check = () => setOn(window.scrollY > 400);
    window.addEventListener('scroll', check, { passive: true });
    check();
    return () => window.removeEventListener('scroll', check);
  }, []);
  return (
    <button
      type="button"
      className={'back-to-top' + (on ? ' visible' : '')}
      aria-label="Torna in cima"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15" /></svg>
    </button>
  );
}

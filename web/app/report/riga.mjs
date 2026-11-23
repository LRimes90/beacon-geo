// Riga di sintesi sotto ogni categoria GEO di /report: modulo puro, così test.js la verifica
// senza build Next. `t` è la funzione di traduzione della pagina.
export function rigaCategoria(checks, t) {
  // il conteggio esclude gli informativi (niente «0/0 ok»), ma i loro nomi restano visibili:
  // un informativo può pesare sul voto (off-site 60 con il sito fuori da Common Crawl)
  const scored = checks.filter((x) => x.status !== 'info');
  const info = checks.filter((x) => x.status === 'info').map((x) => x.name).join(', ');
  const okN = scored.filter((x) => x.status === 'good').length;
  const bad = scored.filter((x) => x.status !== 'good').map((x) => x.name).join(', ');
  return [scored.length ? `${okN}/${scored.length} ${t('controlli ok')}` : '', bad, info ? `${t('informativi')}: ${info}` : ''].filter(Boolean).join(' · ');
}

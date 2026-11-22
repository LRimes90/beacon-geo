// Pesi del punteggio Beacon come MODULO JS.
// Importabile sia dalla CLI (Node ESM) sia dal bundle webpack (Next), senza
// dipendere da una lettura runtime di weights.json: il path calcolato via
// import.meta.url/__dirname NON sopravvive al bundling (viene congelato al
// percorso della build machine), causando ENOENT in produzione.
//
// Profilo EVIDENCE-2026: ogni peso ha accanto la misura che lo giustifica.
// I profili storici (BEACON, PHAROS) restano documentati in weights.json.
export const PROFILE = 'EVIDENCE-2026';

export default {
  // Tabelle e liste citate 2,5x; sezioni autonome +65%; heading-query 41% vs 29%;
  // GEO paper (ACM SIGKDD 2024): citazioni +40%, fluency +15-30%.
  answerability: 0.25,
  // Vercel + MERJ su oltre 500M fetch GPTBot: zero JavaScript eseguito.
  readability: 0.22,
  // BuzzStream, 4M citazioni: il 95% delle pagine citate bloccava GPTBot →
  // il fetch live conta più della riga nel robots.txt.
  access: 0.18,
  // Ahrefs, 1.885 pagine vs 4.000 di controllo: JSON-LD −4,6% su AI Overviews,
  // nessun effetto su ChatGPT e AI Mode.
  structured: 0.15,
  // Ahrefs, 75.000 brand: mentions r=0.664 vs backlink 0.218. Resta 0.15 e non
  // sale: quello che Beacon misura (CCBot + Common Crawl) è un proxy debole
  // delle menzioni di brand. Il peso segue la misura, non l'auspicio.
  offsite: 0.15,
  // Ahrefs, 137.210 domini: il 97% dei llms.txt non viene mai letto.
  // SE Ranking, ~300.000 domini: zero correlazione con le citazioni.
  agentFiles: 0.05,
};

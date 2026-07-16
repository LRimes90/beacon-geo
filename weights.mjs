// Pesi del punteggio Beacon come MODULO JS.
// Importabile sia dalla CLI (Node ESM) sia dal bundle webpack (Next), senza
// dipendere da una lettura runtime di weights.json: il path calcolato via
// import.meta.url/__dirname NON sopravvive al bundling (viene congelato al
// percorso della build machine), causando ENOENT in produzione.
// Fonte: weights.json (profilo BEACON, agentFiles 0.20).
export default {
  access: 0.23,
  agentFiles: 0.20,
  structured: 0.24,
  readability: 0.23,
  offsite: 0.10,
};

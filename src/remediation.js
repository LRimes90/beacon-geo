// src/remediation.js — mappa di remediation WCAG SENZA AI.
// Regola (id axe) → perché conta + esempio "prima → dopo". Deterministico, zero costi,
// zero allucinazioni, testabile. Per le regole non mappate si ricade sul failureSummary
// + helpUrl di axe (sempre presenti): nessun buco di copertura.
// i18n: i contenuti vivono nel catalogo src/messages/ (chiavi remedy.<id>.why|before|after);
// remedyFor accetta `lang` (default 'it') e per le lingue non compilate ricade sull'italiano.
import { makeT } from './messages/index.js';

// Regole axe mappate nel catalogo (l'elenco è il contratto: una entry = 3 chiavi).
export const REMEDIATION_IDS = [
  'image-alt', 'label', 'html-has-lang', 'html-lang-valid', 'color-contrast',
  'link-name', 'button-name', 'select-name', 'document-title', 'heading-order',
  'list', 'region', 'meta-viewport', 'frame-title', 'duplicate-id',
];

// Costruisce la mappa { id: { why, before, after } } nella lingua richiesta.
export function remediationMap(lang = 'it') {
  const t = makeT(lang);
  const map = {};
  for (const id of REMEDIATION_IDS) {
    map[id] = { why: t(`remedy.${id}.why`), before: t(`remedy.${id}.before`), after: t(`remedy.${id}.after`) };
  }
  return map;
}

// Retro-compatibilità: la costante storica resta la versione italiana.
export const REMEDIATION = remediationMap('it');

// Ritorna { why, before, after } per un finding axe; se la regola non è mappata,
// ricade su help + sampleHtml di axe (after=null → la guida completa sta nel helpUrl).
export function remedyFor(finding, lang = 'it') {
  if (REMEDIATION_IDS.includes(finding.id)) {
    const t = makeT(lang);
    return { why: t(`remedy.${finding.id}.why`), before: t(`remedy.${finding.id}.before`), after: t(`remedy.${finding.id}.after`) };
  }
  return {
    why: finding.help || makeT(lang)('remedy.fallbackWhy'),
    before: finding.sampleHtml || null,
    after: null,
  };
}

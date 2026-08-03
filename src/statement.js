// src/statement.js — genera una BOZZA di Dichiarazione di accessibilità (Markdown).
// NON è una certificazione: pre-compila ciò che lo scan sa e lascia [DA COMPLETARE]
// dove serve la persona (stato di conformità, contatti, procedura di reclamo).
// Riferimenti: WCAG 2.1 AA · EN 301 549 · EAA (Dir. UE 2019/882) · in IT: Legge Stanca/AgID.

// Ogni stringa qui dentro arriva dal client (campi del form, audit che il client
// rimanda indietro) e finisce in un documento Markdown. Un ritorno a capo o un
// `## ` inseriti in un nome romperebbero la struttura del documento — si può
// fabbricare una sezione "Stato di conformità: conforme" che non è mai stata
// generata. Quindi: una riga sola, senza caratteri di controllo, e un tetto di
// lunghezza. Il troncamento è visibile (…): meglio di un documento che mente.
function oneLine(v, max) {
  if (typeof v !== 'string') return '';
  const flat = v.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  const capped = flat.length > max ? flat.slice(0, max).trimEnd() + '…' : flat;
  // Appiattire non basta: `**conforme**` su una riga sola resta grassetto e
  // `[testo](url)` resta un link. In un documento che parla di conformità un
  // campo libero non deve poter *sembrare* una dichiarazione. I caratteri di
  // sintassi si ESCAPANO, non si cancellano: il testo digitato resta leggibile,
  // solo non viene interpretato. Prima il tetto, poi l'escape — invertendoli il
  // taglio può cadere subito dopo un backslash e lasciarlo orfano.
  return capped.replace(/([\\`*_[\]#>|])/g, '\\$1');
}

// Raccoglie le criticità note dallo scan (statico + axe) per la sezione "contenuti non accessibili".
function issuesFromAudit(audit) {
  const out = [];
  const st = audit && audit.result;
  if (st && st.checks) for (const c of st.checks) if (c.status === 'crit') out.push(oneLine(c.name + (c.fix ? ' — ' + c.fix : ''), 300));
  const axe = audit && audit.axe;
  if (axe && axe.ok) for (const f of axe.findings) out.push(oneLine(`${f.help} (${f.impact}, ${f.nodes} elementi)`, 300));
  return out.filter(Boolean).slice(0, 100);
}

export function generateStatement(audit, { org, contact, date } = {}) {
  const host = oneLine(audit && audit.host, 120) || '[sito]';
  const url = oneLine(audit && audit.url, 300) || host;
  org = oneLine(org, 120);
  contact = oneLine(contact, 200);
  date = oneLine(date, 40);
  const issues = issuesFromAudit(audit);
  // onesto: se lo scan NON trova nulla, NON dichiariamo conformità — serve l'audit umano.
  const status = issues.length ? 'parzialmente conforme' : '[DA VERIFICARE con audit umano — il test automatico non basta a dichiarare la piena conformità]';

  const L = [
    '# Dichiarazione di accessibilità',
    '',
    '> ⚠️ **Bozza generata automaticamente da Beacon.** Lo stato di conformità e i contenuti legali',
    '> vanno verificati da una persona: il test automatico copre solo parte dei criteri WCAG.',
    '> Questo documento **non è una certificazione**.',
    '',
    `**${org || '[Nome organizzazione]'}** si impegna a rendere accessibile il proprio sito **${host}**`,
    "in conformità a WCAG 2.1 livello AA / EN 301 549, come richiesto dall'European Accessibility Act",
    '(Direttiva UE 2019/882) e, in Italia, dalla Legge 4/2004 (Legge Stanca).',
    '',
    '## Stato di conformità',
    `Il sito è **${status}** con i requisiti sopra indicati.`,
    '',
    '## Contenuti non accessibili',
  ];
  if (issues.length) {
    L.push('Le seguenti criticità, rilevate automaticamente, sono in corso di correzione:', '');
    issues.forEach((i) => L.push('- ' + i));
  } else {
    L.push("- [DA COMPLETARE: elencare le criticità emerse dall'audit umano — tastiera, screen reader, contrasto reale]");
  }
  L.push(
    '',
    '## Metodo di valutazione',
    '- Scansione automatica con Beacon (controlli statici + axe-core sul DOM renderizzato).',
    '- [DA COMPLETARE: verifica umana — navigazione da tastiera, screen reader, zoom, test con utenti].',
    '',
    '## Feedback e contatti',
    `Per segnalare problemi di accessibilità: ${contact || '[email / modulo di contatto]'}`,
    '',
    '## Procedura di attuazione (enforcement)',
    '- [DA COMPLETARE: autorità competente e procedura di reclamo del paese di riferimento].',
    '',
    `*Dichiarazione preparata il ${date || '[data]'} — riferita a ${url}.*`,
  );
  return L.join('\n');
}
export const STATEMENT_LABEL = 'Dichiarazione di accessibilità';

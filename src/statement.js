// src/statement.js — genera una BOZZA di Dichiarazione di accessibilità (Markdown).
// NON è una certificazione: pre-compila ciò che lo scan sa e lascia [DA COMPLETARE]
// dove serve la persona (stato di conformità, contatti, procedura di reclamo).
// Riferimenti: WCAG 2.1 AA · EN 301 549 · EAA (Dir. UE 2019/882) · in IT: Legge Stanca/AgID.

// Raccoglie le criticità note dallo scan (statico + axe) per la sezione "contenuti non accessibili".
function issuesFromAudit(audit) {
  const out = [];
  const st = audit && audit.result;
  if (st && st.checks) for (const c of st.checks) if (c.status === 'crit') out.push(c.name + (c.fix ? ' — ' + c.fix : ''));
  const axe = audit && audit.axe;
  if (axe && axe.ok) for (const f of axe.findings) out.push(`${f.help} (${f.impact}, ${f.nodes} elementi)`);
  return out;
}

export function generateStatement(audit, { org, contact, date } = {}) {
  const host = (audit && audit.host) || '[sito]';
  const url = (audit && audit.url) || host;
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

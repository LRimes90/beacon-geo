// app/skill.md/route.js — Agent Skill di Beacon, servita su /skill.md.
// Formato: frontmatter YAML (name, description) + istruzioni operative, come le
// Agent Skills di Anthropic. Descrive SOLO endpoint che esistono davvero.
export const dynamic = 'force-static';

const TXT = `---
name: beacon-web-audit
description: Usa quando devi misurare un sito su AI-readiness (GEO), accessibilità WCAG 2.2, Core Web Vitals o perimetro AI Act. API pubblica, senza chiave, senza login.
license: MIT
homepage: https://beacon.lucarimediotti.com
---

# Beacon — audit web via API

Beacon analizza un URL pubblico e restituisce punteggi per categoria con le azioni
concrete da fare. Nessuna chiave API, nessun login, nessun dato conservato.
Rate limit: 20 richieste al minuto per IP.

## Endpoint

Base: \`https://beacon.lucarimediotti.com\`. Tutti in \`POST\` con body JSON.

| Percorso | Body | Risposta |
|---|---|---|
| \`/api/audit\` | \`{"url":"https://…","renderJs":false,"lang":"it"}\` | JSON: \`overall\` + \`results\` per categoria |
| \`/api/a11y\` | \`{"url":"https://…","deep":false}\` | JSON: violazioni axe-core WCAG 2.2 |
| \`/api/perf\` | \`{"url":"https://…","strategy":"mobile"}\` | JSON: Core Web Vitals da PageSpeed Insights |
| \`/api/aiact\` | \`{"url":"https://…","answers":{}}\` | JSON: \`scan\` + \`assessment\` UE 2024/1689 |
| \`/api/full\` | \`{"url":"https://…"}\` | JSON: i quattro audit insieme |
| \`/api/llms\` | \`{"url":"https://…"}\` | \`text/plain\`: un llms.txt generato per quel sito |

C'è anche un server MCP su \`/api/mcp\` (transport HTTP, tool \`beacon_audit\`),
descritto in \`/.well-known/mcp.json\`.

## Come leggere la risposta di /api/audit

- \`overall\` (0-100) è il punteggio complessivo. **Il campo non si chiama \`score\`.**
- \`results\` contiene le categorie pesate: \`access\`, \`agentFiles\`, \`structured\`,
  \`readability\`, \`offsite\`. Ognuna ha \`score\` e un array \`checks\`.
- \`rights\` e \`technical\` sono informativi: non entrano nel punteggio.
- Ogni check ha \`status\` (\`good\` | \`warn\` | \`bad\` | \`info\`), \`detail\` e, quando
  serve, \`fix\`: la frase in \`fix\` è l'azione da riportare all'utente.

## Codici di errore

- \`400\` — URL assente o malformato: l'errore è nell'input.
- \`424\` — il sito da analizzare è irraggiungibile (non è un guasto di Beacon).
- \`429\` — rate limit superato: attendi 60 secondi.

Passa \`"lang"\` fra \`it\`, \`en\`, \`de\`, \`fr\`, \`es\`, \`pt\` per avere testi e \`fix\`
nella lingua dell'utente; qualunque altro valore ripiega su \`it\`.

## Limiti dichiarati

Beacon non interroga nessun LLM e non misura le citazioni reali nelle risposte AI:
verifica le condizioni tecniche perché un contenuto sia leggibile e citabile.
Non usa dati a pagamento (volumi di ricerca, backlink, posizionamenti).
`;

export function GET() {
  return new Response(TXT, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

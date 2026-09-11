// app/llms.txt/route.js — il llms.txt di Beacon stesso.
// Da non confondere con /api/llms, che GENERA il llms.txt di un sito di terzi.
// Statico: il contenuto cambia solo quando cambiano i tool, non a ogni richiesta.
export const dynamic = 'force-static';

const TXT = `# Beacon

> Suite di audit web self-hosted e gratuita: GEO/AI-readiness, accessibilità WCAG,
> performance Lighthouse e perimetro AI Act. Nessun login, nessun dato conservato.

Beacon analizza un URL pubblico e restituisce un punteggio per categoria con le
azioni concrete da fare. Il motore è Node a zero dipendenze, il codice è pubblico
(licenza MIT) e può essere eseguito da riga di comando o self-hosted.

## Strumenti

- [GEO checker](https://beacon.lucarimediotti.com/): cosa trovano i crawler AI sul sito (accesso, file agentici, dati strutturati, leggibilità).
- [Accessibilità](https://beacon.lucarimediotti.com/a11y): controlli WCAG 2.2 basati su axe-core.
- [Performance](https://beacon.lucarimediotti.com/perf): Core Web Vitals via PageSpeed Insights.
- [AI Act](https://beacon.lucarimediotti.com/aiact): perimetro di applicabilità del regolamento UE 2024/1689.
- [Report completo](https://beacon.lucarimediotti.com/report): i quattro audit in un unico documento.

## Progetto

- [Codice sorgente](https://github.com/LRimes90/beacon-geo): motore Node + UI Next.js, licenza MIT.
- [Autore](https://lucarimediotti.com/): Luca Rimediotti, web developer in Ticino (Svizzera).

## Limiti dichiarati

Beacon non interroga nessun LLM e non misura le citazioni reali nelle risposte AI:
verifica le condizioni tecniche perché un contenuto sia leggibile e citabile.
Non usa dati a pagamento (volumi di ricerca, backlink, posizionamenti).
`;

export function GET() {
  return new Response(TXT, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

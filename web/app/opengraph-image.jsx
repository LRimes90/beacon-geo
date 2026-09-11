// app/opengraph-image.jsx — anteprima social 1200x630 generata a build time da next/og.
// Convenzione file di Next: popola sia og:image sia twitter:image, senza asset statici
// (il progetto non ha web/public). Prima l'og:image era icon.svg, che nessun social renderizza.
import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';           // l'host è Passenger/Node, non edge
export const alt = 'Beacon — le AI leggono il tuo sito?';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Palette da globals.css (--bg, --beam, --accent, --ink, --muted).
const BG = '#0A1E1C', BEAM = '#E8B15A', ACCENT = '#42D1C8', INK = '#EAF3F1', MUTED = '#9DB4B0';

export default function Image() {
  return new ImageResponse(
    (
      // Satori richiede display:flex esplicito su ogni box con più figli.
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '80px 90px', backgroundColor: BG, position: 'relative',
      }}>
        {/* Alone del faro: cerchi pieni invece di un radial-gradient, che satori
            rende in modo incostante. Stesso effetto, zero rischio in build. */}
        <div style={{ position: 'absolute', top: 150, right: 90, width: 360, height: 360,
                      borderRadius: 360, backgroundColor: BEAM, opacity: 0.10, display: 'flex' }} />
        <div style={{ position: 'absolute', top: 240, right: 180, width: 180, height: 180,
                      borderRadius: 180, backgroundColor: BEAM, opacity: 0.18, display: 'flex' }} />
        <div style={{ position: 'absolute', top: 300, right: 240, width: 60, height: 60,
                      borderRadius: 60, backgroundColor: BEAM, display: 'flex' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 34 }}>
          <div style={{ width: 26, height: 26, borderRadius: 26, backgroundColor: BEAM, display: 'flex' }} />
          <div style={{ fontSize: 40, color: INK, letterSpacing: 2 }}>Beacon</div>
        </div>

        <div style={{ fontSize: 74, color: INK, lineHeight: 1.12, maxWidth: 720 }}>
          Le AI leggono il tuo sito?
        </div>

        <div style={{ fontSize: 31, color: MUTED, marginTop: 28, maxWidth: 700, lineHeight: 1.4 }}>
          Audit gratuito di AI-readiness, accessibilità WCAG, performance e AI Act.
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 54 }}>
          <div style={{ width: 44, height: 3, backgroundColor: ACCENT, display: 'flex' }} />
          <div style={{ fontSize: 26, color: ACCENT }}>beacon.lucarimediotti.com</div>
        </div>
      </div>
    ),
    size,
  );
}

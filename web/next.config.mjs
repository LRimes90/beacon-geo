import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
export default {
  // Server Node autonomo per il deploy su cPanel/Passenger (Namecheap Node.js Selector).
  output: 'standalone',
  // Non esporre "X-Powered-By: Next.js" (info disclosure / fingerprinting).
  poweredByHeader: false,
  experimental: {
    // 'playwright' è una dipendenza opzionale del motore (import dinamico): non bundlarla lato server.
    serverComponentsExternalPackages: ['playwright'],
    // Il motore Beacon è una dipendenza `file:..`: includi la root del monorepo nel file tracing
    // così lo standalone porta con sé il pacchetto 'beacon-geo' (Next 14: chiave sotto experimental).
    outputFileTracingRoot: join(__dirname, '..'),
  },
  // Security header su tutte le risposte (clickjacking, MIME-sniffing, HSTS, referrer).
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
      ],
    }];
  },
};

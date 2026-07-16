import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
export default {
  // Server Node autonomo per il deploy su cPanel/Passenger (Namecheap Node.js Selector).
  output: 'standalone',
  experimental: {
    // 'playwright' è una dipendenza opzionale del motore (import dinamico): non bundlarla lato server.
    serverComponentsExternalPackages: ['playwright'],
    // Il motore Beacon è una dipendenza `file:..`: includi la root del monorepo nel file tracing
    // così lo standalone porta con sé il pacchetto 'beacon-geo' (Next 14: chiave sotto experimental).
    outputFileTracingRoot: join(__dirname, '..'),
  },
};

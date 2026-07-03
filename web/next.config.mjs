/** @type {import('next').NextConfig} */
export default {
  // 'playwright' è una dipendenza opzionale del motore (import dinamico): non bundlarla lato server.
  experimental: { serverComponentsExternalPackages: ['playwright'] },
};

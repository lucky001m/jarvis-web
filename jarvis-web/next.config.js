/** @type {import('next').NextConfig} */
// output: 'export' solo se activa para la build nativa de Capacitor
// (ver scripts/build-capacitor.js). El build normal de Vercel (`next build`
// / `npm run build`) no toca esta rama y sigue sirviendo /app/api en modo
// servidor como hasta ahora.
const isCapacitorBuild = process.env.CAPACITOR_BUILD === "1";

const nextConfig = isCapacitorBuild
  ? {
      output: "export",
      images: { unoptimized: true },
    }
  : {};

module.exports = nextConfig;

// En la web (Vercel) esto queda vacío y las llamadas a /api/... son relativas
// al propio origen, igual que siempre. Solo la build de Capacitor (app nativa
// de iOS, sin servidor propio) inyecta una URL absoluta para llamar al deploy
// de Vercel como API externa. Se define en scripts/build-capacitor.js.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

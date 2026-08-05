// Build estática para Capacitor (app nativa de iOS).
//
// `next build` con output:'export' no admite rutas API dinámicas (POST con
// request.json()), así que aquí ocultamos app/api temporalmente, hacemos el
// export, y lo restauramos al terminar (pase lo que pase). El build normal
// (`npm run build`, el que usa Vercel) no pasa por este script y no se ve
// afectado: app/api sigue ahí siempre en el repo.
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const API_DIR = path.join(__dirname, "..", "app", "api");
const API_DIR_DISABLED = path.join(__dirname, "..", "app", "api.disabled");

const DEFAULT_API_BASE_URL = "https://jarvis-teal-eight.vercel.app";
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL;

if (fs.existsSync(API_DIR_DISABLED)) {
  throw new Error(
    `Ya existe ${API_DIR_DISABLED} — probablemente una build anterior falló a mitad. ` +
      `Renómbralo de vuelta a app/api manualmente y vuelve a intentarlo.`
  );
}

console.log(`Build de Capacitor. API_BASE_URL = ${apiBaseUrl}`);
fs.renameSync(API_DIR, API_DIR_DISABLED);

try {
  execSync("npx next build", {
    stdio: "inherit",
    env: {
      ...process.env,
      CAPACITOR_BUILD: "1",
      NEXT_PUBLIC_API_BASE_URL: apiBaseUrl,
    },
  });
} finally {
  fs.renameSync(API_DIR_DISABLED, API_DIR);
}

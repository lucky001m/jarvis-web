# JARVIS — Fase 1 (Web)

Asistente personal con voz y texto, respondiendo con Claude, e interfaz tipo HUD.

## Cómo arrancarlo

1. Abre esta carpeta en VS Code.
2. Instala dependencias:
   ```powershell
   npm install
   ```
3. Copia `.env.example` a `.env.local`:
   ```powershell
   copy .env.example .env.local
   ```
4. Abre `.env.local` y pega tu clave real de Gemini. La consigues gratis, sin
   tarjeta de crédito, en https://aistudio.google.com/apikey (inicia sesión
   con tu cuenta de Google y pulsa "Create API key").
5. Arranca el proyecto:
   ```powershell
   npm run dev
   ```
6. Abre http://localhost:3000 en **Chrome o Edge** (el reconocimiento de voz
   solo funciona en navegadores basados en Chromium — Firefox no lo soporta).

## Qué hace ya

- Chat con Gemini 2.5 Flash (gratis), con personalidad de Jarvis (system
  prompt en `app/api/chat/route.ts` — edítalo a tu gusto).
- Entrada por voz (botón 🎙) usando reconocimiento de voz nativo del navegador.
- Respuesta hablada en voz alta (síntesis de voz nativa del navegador), con
  voz masculina si tu sistema tiene alguna instalada.
- Núcleo visual tipo HUD que cambia de estado: en reposo, escuchando,
  pensando, hablando.
- **Control de luces por voz**: si le dices algo como "enciende la luz" o
  "apaga la luz", Jarvis lo detecta y llama directamente a Home Assistant
  (que a su vez usa Google Assistant SDK para controlar tu lámpara Govee
  vinculada a Google Home). No hace falta pasar por Gemini para esto — es
  más rápido y no gasta cuota de la API.
- **Recordatorios**: dile "recuérdame que [algo]" y lo añade a tu lista
  de tareas en Home Assistant. Pregúntale "qué tengo pendiente" o "mis
  recordatorios" para que te los lea.
- **Calendario**: dile algo como "añade a mi calendario cita con el
  dentista mañana a las 5" y Jarvis usa Gemini para extraer fecha/hora
  del mensaje, y crea el evento directamente en tu Google Calendar a
  través de Home Assistant.

### Requisitos para el control de luces, recordatorios y calendario

- Tener `home-assistant-docker` corriendo (`docker compose up -d`) **a la
  vez** que `jarvis-web`.
- Rellenar en `.env.local`:
  - `HOME_ASSISTANT_URL` — normalmente `http://localhost:8123`.
  - `HOME_ASSISTANT_TOKEN` — el token de larga duración que creaste en
    Home Assistant (perfil → Tokens de acceso de larga duración).
  - `LIGHT_NAME` — el nombre exacto de tu lámpara tal cual aparece en
    Google Home.
  - `TODO_ENTITY_ID` — el entity_id de tu lista de tareas en Home
    Assistant (por defecto `todo.lista_de_la_compra`).
  - `CALENDAR_ENTITY_ID` — el entity_id de tu calendario de Google en
    Home Assistant.
- Si más adelante añades más luces, se puede ampliar la detección en
  `app/api/chat/route.ts` (función `detectLightIntent`) para reconocer
  varios nombres, no solo uno.

## Qué falta (siguientes fases)

- App móvil (Expo/React Native) conectada a este mismo backend.
- Herramientas: búsqueda web, recordatorios, memoria persistente entre sesiones.
- Control de dispositivos (bombillas, etc.).
- Despliegue en Vercel para acceder desde cualquier sitio (ahora mismo solo
  funciona en tu PC, en local).

## Notas

- La clave de API nunca se expone al navegador: todas las llamadas a Gemini
  pasan por `app/api/chat/route.ts`, que corre en el servidor.
- El modelo usado es `gemini-2.5-flash`. El nivel gratuito tiene un límite de
  uso (unas 250 peticiones al día, 10 por minuto) — de sobra para uso normal
  probando Jarvis. Si algún día lo quieres cambiar por Claude, solo hay que
  reescribir la llamada en `app/api/chat/route.ts` (la estructura del resto
  del proyecto no cambia).

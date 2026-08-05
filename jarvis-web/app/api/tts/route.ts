import { NextRequest, NextResponse } from "next/server";

// La app nativa de iOS (Capacitor) llama a esta ruta desde otro origen
// (capacitor://localhost), así que necesitamos cabeceras CORS para que
// el WebView no bloquee la respuesta.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function corsJson(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: { ...CORS_HEADERS, ...init?.headers },
  });
}

// Voz grave y calmada de la librería pública de ElevenLabs (no es una clonación
// del actor de las películas, solo un estilo similar). Se puede cambiar poniendo
// otro voice id en ELEVENLABS_VOICE_ID.
const DEFAULT_VOICE_ID = "onwK4e9ZLuTAKqWW03F9"; // "Daniel" - voz masculina grave en inglés/multilingüe

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error("Falta ELEVENLABS_API_KEY en .env.local");
    }

    const { text }: { text: string } = await req.json();
    if (!text?.trim()) {
      return corsJson({ error: "Falta texto" }, { status: 400 });
    }

    const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.55, similarity_boost: 0.8 },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(
        `ElevenLabs respondió con error (${res.status}): ${errText.slice(0, 200)}`
      );
    }

    const audio = await res.arrayBuffer();
    return new NextResponse(audio, {
      headers: { "Content-Type": "audio/mpeg", ...CORS_HEADERS },
    });
  } catch (err: any) {
    console.error("Error en /api/tts:", err);
    return corsJson(
      { error: err?.message ?? "Error desconocido" },
      { status: 500 }
    );
  }
}

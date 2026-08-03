import { NextRequest, NextResponse } from "next/server";

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
      return NextResponse.json({ error: "Falta texto" }, { status: 400 });
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
      headers: { "Content-Type": "audio/mpeg" },
    });
  } catch (err: any) {
    console.error("Error en /api/tts:", err);
    return NextResponse.json(
      { error: err?.message ?? "Error desconocido" },
      { status: 500 }
    );
  }
}

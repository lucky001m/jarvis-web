import { NextRequest, NextResponse } from "next/server";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const JARVIS_SYSTEM_PROMPT = `Eres JARVIS, el asistente de inteligencia artificial personal de Lucía.
Responde en español de España, de forma cercana pero eficiente, con un toque de personalidad
elegante y seca (como el JARVIS de las películas de Iron Man): directo, un poco ingenioso,
nunca servil ni empalagoso. Evita las respuestas largas salvo que se pida detalle técnico o
una explicación a fondo. No uses emojis. No uses encabezados ni listas salvo que ayuden
claramente a la claridad. Como tus respuestas se leen en voz alta, evita markdown pesado
(negritas, tablas) y escribe en frases naturales para hablar.`;

type ChatMessage = { role: "user" | "assistant"; content: string };

// --- Home Assistant: helper genérico para llamar servicios ---

async function callHAService(
  domain: string,
  service: string,
  data: Record<string, unknown>,
  returnResponse = false
) {
  const baseUrl = process.env.HOME_ASSISTANT_URL;
  const token = process.env.HOME_ASSISTANT_TOKEN;
  if (!baseUrl || !token) {
    throw new Error(
      "Falta HOME_ASSISTANT_URL o HOME_ASSISTANT_TOKEN en .env.local"
    );
  }
  const url = `${baseUrl}/api/services/${domain}/${service}${
    returnResponse ? "?return_response" : ""
  }`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(
      `Home Assistant respondió con error (${res.status}). Comprueba que sigue abierto en tu PC.`
    );
  }
  return returnResponse ? res.json() : null;
}

function pick(list: string[]) {
  return list[Math.floor(Math.random() * list.length)];
}

// --- Control de luces vía Google Assistant SDK ---

const LIGHT_NAME = process.env.LIGHT_NAME || "TV Backlight 3 Lite";

const ON_PHRASES = ["Hecho. Luz encendida.", "Como ordenes. Ya está.", "Encendida."];
const OFF_PHRASES = ["Hecho. Luz apagada.", "Como ordenes. Ya está.", "Apagada."];

function detectLightIntent(text: string): "on" | "off" | null {
  const lower = text.toLowerCase();
  const mentionsLight = /\b(luz|luces|l[aá]mpara|backlight)\b/.test(lower);
  if (!mentionsLight) return null;
  if (/\b(enciende|prende|activa|ilumina)\b/.test(lower)) return "on";
  if (/\b(apaga|desactiva)\b/.test(lower)) return "off";
  return null;
}

async function sendHomeAssistantCommand(command: string) {
  await callHAService("google_assistant_sdk", "send_text_command", { command });
}

// --- Recordatorios (lista to-do en Home Assistant) ---

const TODO_ENTITY = process.env.TODO_ENTITY_ID || "todo.lista_de_la_compra";

function detectReminderAdd(text: string): string | null {
  const match = text
    .toLowerCase()
    .match(/recu[eé]rdame(?:\s+que)?\s+(.+)/i);
  return match ? match[1].trim() : null;
}

function isReminderListQuery(text: string): boolean {
  return /\b(qu[eé] tengo pendiente|mis recordatorios|recordatorios pendientes)\b/i.test(
    text.toLowerCase()
  );
}

async function addReminder(item: string) {
  await callHAService("todo", "add_item", { entity_id: TODO_ENTITY, item });
}

async function listReminders(): Promise<string[]> {
  const data = await callHAService(
    "todo",
    "get_items",
    { entity_id: TODO_ENTITY },
    true
  );
  const items = data?.service_response?.[TODO_ENTITY]?.items ?? [];
  return items.map((i: any) => i.summary);
}

// --- Calendario (Google Calendar vía Home Assistant) ---

const CALENDAR_ENTITY =
  process.env.CALENDAR_ENTITY_ID || "calendar.marotomorocholucia001_gmail_com";

function detectCalendarIntent(text: string): boolean {
  return /\b(a[ñn]ade.*calendario|agenda|mete.*calendario|apunta.*calendario|crea.*evento|nuevo evento)\b/i.test(
    text.toLowerCase()
  );
}

type CalendarExtraction = {
  summary: string;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM 24h, o null si es todo el día
  duration_minutes: number;
};

async function extractCalendarEvent(
  userText: string
): Promise<CalendarExtraction> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Falta GEMINI_API_KEY en .env.local");
  }

  const today = new Date().toISOString().slice(0, 10);
  const prompt = `Hoy es ${today}. Extrae los datos del evento de calendario que pide este mensaje: "${userText}".
Responde SOLO con un JSON válido, sin texto adicional ni markdown, con este formato exacto:
{"summary": "string corto describiendo el evento", "date": "YYYY-MM-DD", "time": "HH:MM o null si no se especifica hora", "duration_minutes": number (60 si no se especifica)}`;

  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message ?? "Error llamando a Gemini");
  }

  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const cleaned = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

async function createCalendarEvent(event: CalendarExtraction) {
  const hasTime = !!event.time;
  const startDate = new Date(`${event.date}T${event.time ?? "00:00"}:00`);
  const endDate = new Date(
    startDate.getTime() + (event.duration_minutes || 60) * 60000
  );

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}:00`;

  const payload: Record<string, unknown> = {
    entity_id: CALENDAR_ENTITY,
    summary: event.summary,
  };

  if (hasTime) {
    payload.start_date_time = fmt(startDate);
    payload.end_date_time = fmt(endDate);
  } else {
    payload.start_date = event.date;
    payload.end_date = event.date;
  }

  await callHAService("calendar", "create_event", payload);
}

// --- Chat normal con Gemini ---

async function askGemini(messages: ChatMessage[]) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Falta GEMINI_API_KEY en .env.local");
  }

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: JARVIS_SYSTEM_PROMPT }] },
      contents,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error?.message ?? "Error llamando a Gemini");
  }

  return (
    data?.candidates?.[0]?.content?.parts?.[0]?.text ??
    "No he podido generar una respuesta. Inténtalo de nuevo."
  );
}

export async function POST(req: NextRequest) {
  try {
    const { messages }: { messages: ChatMessage[] } = await req.json();
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    const text = lastUserMessage?.content ?? "";

    try {
      // 1. Luces — no gasta llamada a Gemini
      const lightIntent = detectLightIntent(text);
      if (lightIntent) {
        await sendHomeAssistantCommand(
          `${lightIntent === "on" ? "enciende" : "apaga"} ${LIGHT_NAME}`
        );
        const reply = pick(lightIntent === "on" ? ON_PHRASES : OFF_PHRASES);
        return NextResponse.json({ reply });
      }

      // 2. Recordatorios — añadir
      const reminderText = detectReminderAdd(text);
      if (reminderText) {
        await addReminder(reminderText);
        return NextResponse.json({
          reply: `Anotado: ${reminderText}.`,
        });
      }

      // 3. Recordatorios — listar
      if (isReminderListQuery(text)) {
        const items = await listReminders();
        const reply =
          items.length === 0
            ? "No tienes nada pendiente."
            : `Tienes pendiente: ${items.join(", ")}.`;
        return NextResponse.json({ reply });
      }

      // 4. Calendario — usa Gemini para extraer los datos del evento
      if (detectCalendarIntent(text)) {
        const event = await extractCalendarEvent(text);
        await createCalendarEvent(event);
        const cuando = event.time
          ? `el ${event.date} a las ${event.time}`
          : `el ${event.date}`;
        return NextResponse.json({
          reply: `Evento añadido: ${event.summary}, ${cuando}.`,
        });
      }
    } catch (err: any) {
      return NextResponse.json(
        { error: err?.message ?? "No se pudo completar la acción" },
        { status: 500 }
      );
    }

    // 5. Conversación normal
    const reply = await askGemini(messages);
    return NextResponse.json({ reply });
  } catch (err: any) {
    console.error("Error en /api/chat:", err);
    return NextResponse.json(
      { error: err?.message ?? "Error desconocido" },
      { status: 500 }
    );
  }
}


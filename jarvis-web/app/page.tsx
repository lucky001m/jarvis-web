"use client";

import { useEffect, useRef, useState } from "react";
import JarvisOrb, { OrbState } from "./JarvisOrb";
import styles from "./page.module.css";
import { useMascaraBLE } from "./hooks/useMascaraBLE"

type ChatMessage = { role: "user" | "assistant"; content: string };

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [stateLabel, setStateLabel] = useState("");
  const [clock, setClock] = useState("");
  const [speechSupported, setSpeechSupported] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState("");
  const [voiceEngine, setVoiceEngine] = useState<"browser" | "elevenlabs">(
    "browser"
  );

  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const isListeningRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const handleSendRef = useRef<(text: string) => void>(() => {});

  const { conectado: mascaraConectada, conectar: conectarMascara, enviarComando: enviarComandoMascara } = useMascaraBLE();

  // reloj HUD
  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // configurar reconocimiento de voz (Web Speech API)
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "es-ES";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      handleSendRef.current(transcript);
    };

    recognition.onerror = () => {
      isListeningRef.current = false;
      setOrbState("idle");
      setStateLabel("");
    };

    recognition.onend = () => {
      isListeningRef.current = false;
      setOrbState((s) => (s === "listening" ? "idle" : s));
      setStateLabel((l) => (l === "escuchando" ? "" : l));
    };

    recognitionRef.current = recognition;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // cargar voces disponibles del sistema (se cargan de forma asíncrona en algunos navegadores)
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;

    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      if (available.length === 0) return;
      setVoices(available);

      const saved = localStorage.getItem("jarvis-voice-uri");
      if (saved && available.some((v) => v.voiceURI === saved)) {
        setSelectedVoiceURI(saved);
        return;
      }

      const esVoices = available.filter((v) => v.lang.startsWith("es"));
      const pool = esVoices.length > 0 ? esVoices : available;
      // preferimos voces neuronales/online (suenan mucho más naturales y graves)
      // y nombres masculinos típicos en español (Windows/Edge/Chrome)
      const maleNames = [
        "álvaro",
        "alvaro",
        "pablo",
        "jorge",
        "diego",
        "carlos",
        "enrique",
        "tomás",
        "tomas",
        "raúl",
        "raul",
        "male",
        "hombre",
      ];
      const scored = [...pool].sort((a, b) => {
        const score = (v: SpeechSynthesisVoice) => {
          let s = 0;
          const name = v.name.toLowerCase();
          if (/natural|online|neural/.test(name)) s += 2;
          if (maleNames.some((n) => name.includes(n))) s += 1;
          return s;
        };
        return score(b) - score(a);
      });
      setSelectedVoiceURI(scored[0]?.voiceURI ?? "");
    };

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  function onVoiceChange(uri: string) {
    setSelectedVoiceURI(uri);
    localStorage.setItem("jarvis-voice-uri", uri);
  }

  // recordar el motor de voz elegido (navegador vs. ElevenLabs)
  useEffect(() => {
    const saved = localStorage.getItem("jarvis-voice-engine");
    if (saved === "elevenlabs" || saved === "browser") {
      setVoiceEngine(saved);
    }
  }, []);

  function onVoiceEngineChange(engine: "browser" | "elevenlabs") {
    setVoiceEngine(engine);
    localStorage.setItem("jarvis-voice-engine", engine);
  }

  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  function toggleListening() {
    if (!speechSupported) return;
    if (isListeningRef.current) {
      recognitionRef.current?.stop();
      isListeningRef.current = false;
      setOrbState("idle");
      setStateLabel("");
      return;
    }
    setErrorMsg("");
    isListeningRef.current = true;
    setOrbState("listening");
    setStateLabel("escuchando");
    try {
      recognitionRef.current?.start();
    } catch {
      // ya estaba iniciado, ignorar
    }
  }

  // el motor de voz del navegador no sabe leer "Jarvis" en inglés; lo sustituimos
  // por una grafía que el sintetizador sí pronuncia bien (solo afecta al audio)
  function applyPronunciationFixes(text: string) {
    return text.replace(/jarvis/gi, "Yarvis");
  }

  function speakBrowser(text: string) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(applyPronunciationFixes(text));
    utterance.lang = "es-ES";
    utterance.rate = 0.95;
    utterance.pitch = 0.8;

    const voice = voices.find((v) => v.voiceURI === selectedVoiceURI);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }

    utterance.onstart = () => {
      setOrbState("speaking");
      setStateLabel("hablando");
    };
    utterance.onend = () => {
      setOrbState("idle");
      setStateLabel("");
    };
    window.speechSynthesis.speak(utterance);
  }

  async function speakElevenLabs(text: string) {
    audioRef.current?.pause();
    setOrbState("thinking");
    setStateLabel("generando voz");
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error generando la voz");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplay = () => {
        setOrbState("speaking");
        setStateLabel("hablando");
      };
      audio.onended = () => {
        setOrbState("idle");
        setStateLabel("");
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setOrbState("idle");
        setStateLabel("");
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch (err: any) {
      setErrorMsg(err.message ?? "No se pudo generar la voz de ElevenLabs");
      setOrbState("idle");
      setStateLabel("");
      // si falla ElevenLabs (sin clave, sin crédito...), seguimos oyendo a Jarvis igualmente
      speakBrowser(text);
    }
  }

  function speak(text: string) {
    if (voiceEngine === "elevenlabs") {
      speakElevenLabs(text);
    } else {
      speakBrowser(text);
    }
  }

  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    setErrorMsg("");

    // --- Comandos de la máscara de Iron Man, se resuelven aquí sin pasar por Gemini ---
    const texto = trimmed.toLowerCase();
    const esAbrir = /(abre|abrir)\s+(la\s+)?(m[aá]scara|careta)/.test(texto);
    const esCerrar = /(cierra|cerrar)\s+(la\s+)?(m[aá]scara|careta)/.test(texto);
    const esMusica = /(pon|reproduce|suena)\s+(la\s+)?m[uú]sica/.test(texto);
    const esParar = /^parar?$/.test(texto.trim()) || /(para|detener|apaga)\s+(la\s+)?m[uú]sica/.test(texto);

    if (esAbrir || esCerrar || esMusica || esParar) {
      const nextMessages: ChatMessage[] = [
        ...messages,
        { role: "user", content: trimmed },
      ];
      setMessages(nextMessages);
      setInput("");

      let respuesta = "";
      if (!mascaraConectada) {
        respuesta = "La máscara no está conectada por Bluetooth todavía.";
      } else if (esAbrir) {
        await enviarComandoMascara("ABRIR");
        respuesta = "Abriendo la máscara.";
      } else if (esCerrar) {
        await enviarComandoMascara("CERRAR");
        respuesta = "Cerrando la máscara.";
      } else if (esMusica) {
        await enviarComandoMascara("MUSICA 1");
        respuesta = "Reproduciendo música.";
      } else if (esParar) {
        await enviarComandoMascara("PARAR");
        respuesta = "Música detenida.";
      }

      setMessages((prev) => [...prev, { role: "assistant", content: respuesta }]);
      speak(respuesta);
      return; // no seguimos hacia Gemini
    }
    // --- fin comandos de la máscara ---

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];
    setMessages(nextMessages);
    setInput("");
    setOrbState("thinking");
    setStateLabel("procesando");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error llamando a Jarvis");
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);
      speak(data.reply);
    } catch (err: any) {
      setErrorMsg(err.message ?? "Algo ha fallado");
      setOrbState("idle");
      setStateLabel("");
    }
  }
  handleSendRef.current = handleSend;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleSend(input);
  }

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <span className={styles.brand}>J.A.R.V.I.S.</span>
        <span className={styles.clock}>{clock}</span>
      </header>

      <main className={styles.main}>
        <aside className={styles.sidePanel}>
          <h3>Sistema</h3>
          <div className={styles.statRow}>
            <span>Estado</span>
            <span>En línea</span>
          </div>
          <div className={styles.statRow}>
            <span>Modelo</span>
            <span>Claude</span>
          </div>
          <div className={styles.statRow}>
            <span>Motor voz</span>
            <span style={{ display: "flex", gap: 4 }}>
              <select
                className={styles.voiceSelect}
                value={voiceEngine}
                onChange={(e) =>
                  onVoiceEngineChange(e.target.value as "browser" | "elevenlabs")
                }
                title="Elige el motor de voz de Jarvis"
              >
                <option value="browser">Navegador</option>
                <option value="elevenlabs">IA (ElevenLabs)</option>
              </select>
              <button
                type="button"
                className={styles.iconBtn}
                style={{ padding: "0 8px", fontSize: 11 }}
                onClick={() => speak("Hola, soy Jarvis.")}
                title="Probar esta voz"
              >
                ▶
              </button>
            </span>
          </div>
          {voiceEngine === "browser" && (
            <div className={styles.statRow}>
              <span>Voz</span>
              {voices.length > 0 ? (
                <select
                  className={styles.voiceSelect}
                  value={selectedVoiceURI}
                  onChange={(e) => onVoiceChange(e.target.value)}
                  title="Elige la voz de Jarvis"
                >
                  {voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span>{speechSupported ? "Activa" : "No disponible"}</span>
              )}
            </div>
          )}
          <div className={styles.statRow}>
            <span>Turnos</span>
            <span>{messages.length}</span>
          </div>
          <div className={styles.statRow}>
            <span>Máscara</span>
            <button onClick={conectarMascara} className={styles.iconBtn}>
              {mascaraConectada ? "Conectada ✓" : "Conectar"}
            </button>
          </div>
        </aside>

        <section className={styles.center}>
          <JarvisOrb state={orbState} />
          <span className={styles.stateLabel}>{stateLabel}</span>

          <div className={styles.transcript} ref={transcriptRef}>
            {messages.length === 0 && (
              <p className={styles.empty}>
                Habla o escribe para iniciar sesión con Jarvis.
              </p>
            )}
            {messages.map((m, i) => (
              <p
                key={i}
                className={`${styles.line} ${
                  m.role === "user" ? styles.lineUser : styles.lineJarvis
                }`}
              >
                <span className={styles.who}>
                  {m.role === "user" ? "TÚ" : "JARVIS"}
                </span>
                {m.content}
              </p>
            ))}
          </div>

          <form className={styles.controls} onSubmit={onSubmit}>
            <input
              className={styles.textInput}
              placeholder="Escribe un mensaje…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button
              type="button"
              className={styles.iconBtn}
              data-active={orbState === "listening"}
              onClick={toggleListening}
              disabled={!speechSupported}
              title={
                speechSupported
                  ? "Hablar con Jarvis"
                  : "Tu navegador no soporta reconocimiento de voz (usa Chrome o Edge)"
              }
            >
              {orbState === "listening" ? "● Escuchando" : "🎙 Voz"}
            </button>
            <button className={styles.iconBtn} type="submit">
              Enviar
            </button>
          </form>

          {errorMsg && <p className={styles.warn}>{errorMsg}</p>}
          {!speechSupported && (
            <p className={styles.warn}>
              El reconocimiento de voz solo funciona en Chrome o Edge.
            </p>
          )}
        </section>

        <aside className={styles.sidePanel}>
          <h3>Registro</h3>
          <div className={styles.statRow}>
            <span>Sesión</span>
            <span>local</span>
          </div>
          <div className={styles.statRow}>
            <span>Ubicación</span>
            <span>Madrid</span>
          </div>
        </aside>
      </main>

      <footer className={styles.footer}>
        JARVIS · Sistema personal de Lucía · v0.1
      </footer>
    </div>
  );
}

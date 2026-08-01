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

  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const isListeningRef = useRef(false);

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
      handleSend(transcript);
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

  function speak(text: string) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-ES";
    utterance.rate = 1.02;
    utterance.pitch = 0.75;

    const voices = window.speechSynthesis.getVoices();
    const esVoices = voices.filter((v) => v.lang.startsWith("es"));
    // nombres típicos de voces masculinas en español (Windows/Edge/Chrome)
    const maleNames = [
      "pablo",
      "jorge",
      "diego",
      "carlos",
      "enrique",
      "male",
      "hombre",
    ];
    const maleVoice = esVoices.find((v) =>
      maleNames.some((n) => v.name.toLowerCase().includes(n))
    );
    utterance.voice = maleVoice ?? esVoices[0] ?? null;

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

  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    setErrorMsg("");

    // --- Comandos de la máscara de Iron Man, se resuelven aquí sin pasar por Gemini ---
    const texto = trimmed.toLowerCase();
    const esAbrir = /(abre|abrir)\s+(la\s+)?(m[aá]scara|careta)/.test(texto);
    const esCerrar = /(cierra|cerrar)\s+(la\s+)?(m[aá]scara|careta)/.test(texto);
    const esMusica = /(pon|reproduce|suena)\s+(la\s+)?m[uú]sica/.test(texto);
    const esParar = /(para|detener|apaga)\s+(la\s+)?m[uú]sica/.test(texto);

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
            <span>Voz</span>
            <span>{speechSupported ? "Activa" : "No disponible"}</span>
          </div>
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

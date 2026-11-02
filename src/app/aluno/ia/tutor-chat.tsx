"use client";

import { useEffect, useRef, useState } from "react";
import { buttonClass, inputClass } from "@/components/ui";

type Msg = { id: string; role: "user" | "assistant"; content: string };

// Tipos mínimos da API de voz do navegador (Chrome/Edge/Safari usam o prefixo webkit).
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
};
type RecognitionCtor = new () => Recognition;

function getRecognition(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function speak(text: string, onEnd: () => void) {
  const synth = window.speechSynthesis;
  if (!synth) return onEnd();
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[*#_`>]/g, ""));
  u.lang = "pt-BR";
  const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith("pt-br"));
  if (voice) u.voice = voice;
  u.onend = onEnd;
  u.onerror = onEnd;
  synth.speak(u);
}

const SUGGESTIONS = [
  "Não entendi frações equivalentes",
  "Me ajuda a montar um plano de estudos para a prova",
  "Como começo uma redação dissertativa?",
];

export function TutorChat({ firstName, enabled, initialRemaining, initialMessages }: {
  firstName: string;
  enabled: boolean;
  initialRemaining: number;
  initialMessages: Msg[];
}) {
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState(initialRemaining);
  const [voiceMode, setVoiceMode] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const voiceModeRef = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => setVoiceSupported(Boolean(getRecognition()) && "speechSynthesis" in window), []);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [messages]);
  useEffect(() => () => {
    recRef.current?.stop();
    window.speechSynthesis?.cancel();
  }, []);

  async function ask(text: string, viaVoice: boolean) {
    const question = text.trim();
    if (!question || busy) return;
    setError("");
    setInput("");
    setBusy(true);
    const answerId = `a${Date.now()}`;
    setMessages((m) => [...m, { id: `u${Date.now()}`, role: "user", content: question }, { id: answerId, role: "assistant", content: "" }]);
    const setAnswer = (fn: (prev: string) => string) =>
      setMessages((m) => m.map((x) => (x.id === answerId ? { ...x, content: fn(x.content) } : x)));

    let answer = "";
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, voice: viaVoice }),
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Não deu para falar com a IA agora.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line) continue;
          const e = JSON.parse(line) as { t: string; v?: string; remaining?: number };
          if (e.t === "delta") { answer += e.v; setAnswer((p) => p + e.v); }
          if (e.t === "replace") { answer = e.v ?? ""; setAnswer(() => answer); }
          if (e.t === "error") throw new Error(e.v);
          if (e.t === "done") setRemaining(e.remaining ?? 0);
        }
      }
    } catch (err) {
      answer = "";
      setMessages((m) => m.filter((x) => x.id !== answerId || x.content));
      setError(err instanceof Error ? err.message : "Algo deu errado.");
    } finally {
      setBusy(false);
    }

    if (viaVoice && answer && voiceModeRef.current) {
      setSpeaking(true);
      speak(answer, () => {
        setSpeaking(false);
        if (voiceModeRef.current) listen(); // conversa contínua: depois de falar, volta a ouvir
      });
    }
  }

  function listen() {
    const Ctor = getRecognition();
    if (!Ctor) return;
    window.speechSynthesis?.cancel();
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      setInput(text);
      if (e.results[e.results.length - 1].isFinal) finalText = text;
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed") {
        setError("Libere o microfone no navegador para conversar por voz.");
        stopVoice();
      }
    };
    rec.onend = () => {
      setListening(false);
      if (finalText.trim()) ask(finalText, true);
    };
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  function startVoice() {
    voiceModeRef.current = true;
    setVoiceMode(true);
    listen();
  }

  function stopVoice() {
    voiceModeRef.current = false;
    setVoiceMode(false);
    setListening(false);
    setSpeaking(false);
    recRef.current?.stop();
    window.speechSynthesis?.cancel();
  }

  if (!enabled) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="font-semibold text-brand">A IA tutora ainda não foi ligada.</p>
        <p className="mt-1 text-sm text-slate-600">Assim que a escola ativar, ela aparece aqui para tirar dúvidas por texto e por voz.</p>
      </section>
    );
  }

  const status = listening ? "Ouvindo…" : busy ? "Pensando…" : speaking ? "Falando…" : "Toque para falar";

  return (
    <section className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm">
        <span className="text-slate-600">Ela te guia até a resposta, não entrega pronta.</span>
        <span className="whitespace-nowrap font-medium text-brand">{remaining} perguntas hoje</span>
      </div>

      <div className="max-h-[60vh] min-h-[40vh] space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="space-y-3 text-sm text-slate-600">
            <p>Oi, {firstName}! Em que matéria você quer ajuda hoje?</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => ask(s, false)} className="rounded-full border border-slate-300 px-3 py-1 hover:border-brand">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <p className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "bg-brand text-white" : "bg-slate-100 text-slate-800"}`}>
              {m.content || <span className="animate-pulse">…</span>}
            </p>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {error && <p className="mx-4 mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {voiceMode ? (
        <div className="flex flex-col items-center gap-3 border-t border-slate-100 px-4 py-5">
          <button
            onClick={() => (listening ? recRef.current?.stop() : !busy && !speaking && listen())}
            className={`h-20 w-20 rounded-full bg-brand text-white shadow-lg transition ${listening ? "scale-110 animate-pulse" : ""}`}
            aria-label={status}
          >
            {listening ? "●" : "🎙"}
          </button>
          <p className="text-sm text-slate-600">{input && listening ? `“${input}”` : status}</p>
          <button onClick={stopVoice} className="text-sm text-brand underline">Voltar para o texto</button>
        </div>
      ) : (
        <form
          onSubmit={(e) => { e.preventDefault(); ask(input, false); }}
          className="flex gap-2 border-t border-slate-100 p-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={remaining > 0 ? "Escreva sua dúvida…" : "Limite de hoje atingido"}
            maxLength={1500}
            disabled={busy || remaining <= 0}
            className={inputClass}
          />
          {voiceSupported && (
            <button type="button" onClick={startVoice} disabled={busy || remaining <= 0} className="rounded-lg border border-slate-300 px-3 disabled:opacity-50" aria-label="Conversar por voz">
              🎙
            </button>
          )}
          <button disabled={busy || !input.trim() || remaining <= 0} className={buttonClass}>Enviar</button>
        </form>
      )}
    </section>
  );
}

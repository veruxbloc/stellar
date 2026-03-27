"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, X, Send, Sparkles } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function FloatingAgent() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "¡Hola! Soy el asistente de Verus. Puedo mostrarte proyectos disponibles, estadísticas y más. ¿En qué te ayudo?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Error al conectar. Intentá de nuevo." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @keyframes fab-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.4), 0 8px 32px rgba(99,102,241,0.3); }
          50% { box-shadow: 0 0 0 10px rgba(99,102,241,0), 0 8px 32px rgba(99,102,241,0.5); }
        }
        @keyframes chat-in {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
        @keyframes msg-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dot-bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-5px); }
        }
        .fab { animation: fab-pulse 2.5s ease-in-out infinite; }
        .chat-window { animation: chat-in 0.28s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .msg { animation: msg-in 0.22s ease forwards; }
        .dot:nth-child(1) { animation: dot-bounce 1.2s ease-in-out infinite 0s; }
        .dot:nth-child(2) { animation: dot-bounce 1.2s ease-in-out infinite 0.15s; }
        .dot:nth-child(3) { animation: dot-bounce 1.2s ease-in-out infinite 0.3s; }
      `}</style>

      {/* Chat window */}
      {open && (
        <div
          className="chat-window fixed bottom-24 right-5 z-50 w-[360px] flex flex-col"
          style={{
            height: "480px",
            borderRadius: "20px",
            background: "rgba(15,15,25,0.92)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.15) inset",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-5 py-4 shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div
              className="flex items-center justify-center w-8 h-8 rounded-xl"
              style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
            >
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white text-sm font-semibold leading-none">Agente Verus</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                IA con datos en tiempo real
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="ml-auto w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: "rgba(255,255,255,0.4)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.9)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ scrollbarWidth: "none" }}>
            {messages.map((msg, i) => (
              <div key={i} className={`msg flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                {msg.role === "assistant" && (
                  <div
                    className="w-6 h-6 rounded-lg shrink-0 flex items-center justify-center mt-0.5"
                    style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
                  >
                    <Bot className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
                <div
                  className="max-w-[75%] px-3.5 py-2.5 text-sm leading-relaxed"
                  style={
                    msg.role === "assistant"
                      ? {
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: "4px 14px 14px 14px",
                          color: "rgba(255,255,255,0.88)",
                        }
                      : {
                          background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                          borderRadius: "14px 4px 14px 14px",
                          color: "white",
                        }
                  }
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2 items-end">
                <div
                  className="w-6 h-6 rounded-lg shrink-0 flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
                >
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
                <div
                  className="px-4 py-3 flex gap-1.5 items-center"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "4px 14px 14px 14px",
                  }}
                >
                  <span className="dot w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#6366f1" }} />
                  <span className="dot w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#6366f1" }} />
                  <span className="dot w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#6366f1" }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div
            className="px-4 py-3 shrink-0 flex gap-2"
            style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="Escribí tu consulta..."
              disabled={loading}
              className="flex-1 text-sm px-4 py-2.5 rounded-xl outline-none transition-all"
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.9)",
                caretColor: "#6366f1",
              }}
              onFocus={(e) => (e.target.style.borderColor = "rgba(99,102,241,0.5)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0"
              style={{
                background: input.trim() && !loading ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(255,255,255,0.08)",
                color: input.trim() && !loading ? "white" : "rgba(255,255,255,0.3)",
              }}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fab fixed bottom-5 right-5 z-50 w-14 h-14 rounded-2xl flex items-center justify-center transition-transform active:scale-95"
        style={{
          background: open
            ? "rgba(30,30,45,0.95)"
            : "linear-gradient(135deg,#6366f1,#8b5cf6)",
          border: "1px solid rgba(255,255,255,0.15)",
        }}
      >
        {open ? (
          <X className="w-5 h-5 text-white" />
        ) : (
          <Bot className="w-6 h-6 text-white" />
        )}
      </button>
    </>
  );
}

"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Чем грузинские хинкали отличаются от пельменей?",
  "Что попробовать в армянской кухне сладкоежке?",
  "Какие блюда готовят с тыквой?",
];

// Показываем ссылки вида [текст](/путь); остальной текст — как есть
function renderText(text: string): ReactNode[] {
  return text.split(/(\[[^\]]+\]\([^)\s]+\))/g).map((part, i) => {
    const m = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (!m) return part;
    const [, label, href] = m;
    return href.startsWith("/") ? (
      <Link key={i} href={href} className="text-accent underline">{label}</Link>
    ) : (
      <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline">{label}</a>
    );
  });
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    const next: Message[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-20) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Ошибка запроса");
      setMessages([...next, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка запроса");
      setMessages(messages);
      setInput(content);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line p-4">
      <div className="flex min-h-64 flex-col gap-3">
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} className="rounded-full border border-line px-3 py-1.5 text-left text-sm hover:border-accent">
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "max-w-[85%] self-end rounded-2xl bg-accent px-4 py-2 text-white"
                : "max-w-[85%] self-start whitespace-pre-wrap rounded-2xl bg-accent-soft px-4 py-2"
            }
          >
            {m.role === "assistant" ? renderText(m.content) : m.content}
          </div>
        ))}
        {loading && <div className="self-start text-sm text-muted">Ассистент думает…</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Спросите про блюдо или продукты"
          maxLength={4000}
          className="min-w-0 flex-1 rounded-lg border border-line bg-transparent px-4 py-2.5 outline-none focus:border-accent"
        />
        <button disabled={loading} className="rounded-lg bg-accent px-5 py-2.5 font-medium text-white disabled:opacity-50">
          Отправить
        </button>
      </form>
    </div>
  );
}

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
      <Link key={i} href={href} className="font-semibold underline decoration-accent decoration-2 underline-offset-2">{label}</Link>
    ) : (
      <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="font-semibold underline decoration-accent decoration-2 underline-offset-2">{label}</a>
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
    <div className="frame flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex min-h-64 flex-col gap-3">
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} className="border-2 border-ink px-3 py-1.5 text-left text-sm hover:bg-ink hover:text-light">
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
                ? "max-w-[85%] self-end rounded-[20px] bg-ink px-4 py-2 text-light"
                : "max-w-[85%] self-start whitespace-pre-wrap rounded-[20px] border-2 border-ink bg-light px-4 py-2"
            }
          >
            {m.role === "assistant" ? renderText(m.content) : m.content}
          </div>
        ))}
        {loading && <div className="self-start text-sm">// гид думает…</div>}
        {error && <div className="text-sm text-accent">{error}</div>}
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
          className="min-w-0 flex-1 border-2 border-ink bg-transparent px-4 py-2.5 outline-none focus:bg-light"
        />
        <button disabled={loading} className="bg-ink px-5 py-2.5 font-bold uppercase text-light hover:bg-moss disabled:opacity-50">
          Отправить
        </button>
      </form>
    </div>
  );
}

import type { Metadata } from "next";
import { Chat } from "./Chat";

export const metadata: Metadata = { title: "Кулинарный ассистент" };

export default function AssistantPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-serif text-3xl font-semibold">Кулинарный ассистент</h1>
      <p className="text-muted">Подберёт блюдо под настроение, продукты в холодильнике или диету и ответит по рецептам из базы.</p>
      <Chat />
    </div>
  );
}

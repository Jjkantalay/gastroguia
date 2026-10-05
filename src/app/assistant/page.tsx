import type { Metadata } from "next";
import { Chat } from "./Chat";

export const metadata: Metadata = { title: "Кулинарный ассистент" };

export default function AssistantPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-serif text-3xl font-semibold">Кулинарный ассистент</h1>
      <p className="text-muted">Расскажет о блюдах Кавказа, их истории и ингредиентах и поможет выбрать, что попробовать.</p>
      <Chat />
    </div>
  );
}

import type { Metadata } from "next";
import { Chat } from "./Chat";

export const metadata: Metadata = { title: "Спроси гида" };

export default function AssistantPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 border-b-2 border-ink pb-3">
        <h1 className="t-section">Спроси гида</h1>
        <p className="text-base sm:text-xl">расскажет о блюдах Кавказа, их истории и ингредиентах и поможет выбрать, что попробовать</p>
      </div>
      <Chat />
    </div>
  );
}

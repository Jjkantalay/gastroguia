import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { askAssistant, chatMessageSchema } from "@/lib/agent";

export const maxDuration = 120;

const bodySchema = z.object({
  messages: z
    .array(chatMessageSchema)
    .min(1)
    .max(30)
    .refine((m) => m.at(-1)?.role === "user", "Последнее сообщение должно быть от пользователя"),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return NextResponse.json({ error: "Ассистент не настроен: не задан ANTHROPIC_API_KEY" }, { status: 503 });
  }

  try {
    const reply = await askAssistant(parsed.data.messages);
    return NextResponse.json({ reply });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Ассистент перегружен, попробуйте через минуту" }, { status: 429 });
    }
    if (e instanceof Anthropic.AuthenticationError) {
      console.error("Проверьте ANTHROPIC_API_KEY", e.message);
      return NextResponse.json({ error: "Ассистент не настроен" }, { status: 503 });
    }
    if (e instanceof Anthropic.APIError) {
      console.error("Claude API", e.status, e.message);
      return NextResponse.json({ error: "Ассистент временно недоступен" }, { status: 502 });
    }
    throw e;
  }
}

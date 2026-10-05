import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { dishFiltersSchema, getDish, listCuisines, searchDishes } from "./dishes";

const client = new Anthropic();
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

const SYSTEM_PROMPT = `Ты — гид сайта «Гастрогид», путеводителя по блюдам Кавказа. Рассказываешь о блюдах, их истории, ингредиентах и традициях подачи, помогаешь выбрать, что попробовать или приготовить, с учётом аллергенов и предпочтений.

Сведения о блюдах бери из базы сайта через инструменты. Если нужного блюда в базе нет, скажи об этом прямо; общие кулинарные знания можно добавлять от себя, но не выдавай их за данные сайта. У части блюд в базе есть переводы на английский и испанский — используй их, если собеседник пишет на этих языках.

Когда упоминаешь блюдо из базы, давай ссылку в формате [Название](/dishes/слаг). Отвечай на языке собеседника, коротко и по делу.`;

const searchTool = betaZodTool({
  name: "search_dishes",
  description:
    "Ищет блюда в базе Гастрогида по тексту и фильтрам (кухня, тип блюда, диета, время, калории, ингредиенты). Возвращает краткие карточки со слагами. Без фильтров возвращает весь список по алфавиту.",
  inputSchema: dishFiltersSchema.omit({ offset: true }).extend({
    limit: z.number().int().min(1).max(20).default(10),
  }),
  run: async (input) => JSON.stringify(await searchDishes(input)),
});

const getDishTool = betaZodTool({
  name: "get_dish",
  description: "Возвращает всё о блюде по слагу: описание, историю, цитату, ингредиенты, аллергены, переводы, а также шаги и КБЖУ, если они заполнены.",
  inputSchema: z.object({ slug: z.string().describe("Слаг блюда из search_dishes") }),
  run: async ({ slug }) => {
    const dish = await getDish(slug);
    return dish ? JSON.stringify(dish) : `Блюдо со слагом «${slug}» не найдено`;
  },
});

const listCuisinesTool = betaZodTool({
  name: "list_cuisines",
  description: "Список кухонь в базе со слагами и количеством блюд.",
  inputSchema: z.object({}),
  run: async () => JSON.stringify(await listCuisines()),
});

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export async function askAssistant(history: ChatMessage[]): Promise<string> {
  const final = await client.beta.messages.toolRunner({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    output_config: { effort: "medium" },
    // При отказе классификатора запрос автоматически уходит на подходящую модель
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    tools: [searchTool, getDishTool, listCuisinesTool],
    messages: history,
    max_iterations: 8,
  });

  if (final.stop_reason === "refusal") {
    return "Не могу помочь с этим запросом. Спросите, пожалуйста, что-нибудь о блюдах и рецептах.";
  }
  const text = final.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return text || "Не получилось сформулировать ответ, попробуйте переспросить.";
}

import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { searchDishes } from "@/lib/dishes";
import { filtersFromSearchParams } from "@/lib/filters";

// GET /api/dishes?q=суп&cuisine=russkaya&course=суп&vegetarian=true&maxTimeMin=60&with=свёкла&without=мясо
export async function GET(req: NextRequest) {
  try {
    const filters = filtersFromSearchParams(req.nextUrl.searchParams);
    const items = await searchDishes(filters);
    return NextResponse.json({ items });
  } catch (e) {
    if (e instanceof ZodError) return NextResponse.json({ error: e.issues }, { status: 400 });
    throw e;
  }
}

import { NextResponse } from "next/server";
import { getDish } from "@/lib/dishes";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const dish = await getDish((await params).slug);
  if (!dish) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(dish);
}

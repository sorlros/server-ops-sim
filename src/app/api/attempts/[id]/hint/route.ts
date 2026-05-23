import { NextResponse } from "next/server";
import { useHint } from "@/application/usecases/scenario-usecases";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    return NextResponse.json(useHint(params.id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 404 });
  }
}

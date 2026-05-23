import { NextResponse } from "next/server";
import { executeCommand, loadAttempt } from "@/application/usecases/scenario-usecases";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    return NextResponse.json(loadAttempt(params.id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 404 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const body = (await request.json().catch(() => ({}))) as { command?: string };
    if (!body.command) {
      return NextResponse.json({ error: "command is required" }, { status: 400 });
    }
    return NextResponse.json(executeCommand(params.id, body.command));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 404 });
  }
}

import { NextResponse } from "next/server";
import { listScenarioCatalog } from "@/application/usecases/scenario-usecases";

export async function GET() {
  return NextResponse.json({ scenarios: listScenarioCatalog() });
}

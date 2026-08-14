import { promises as fs } from "fs";
import { NextResponse } from "next/server";
import { stateFile } from "@/lib/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const raw = await fs.readFile(stateFile(), "utf8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    // Missing or corrupt state: return an empty-but-valid shape so the UI
    // renders its empty states instead of crashing.
    return NextResponse.json({
      project: {},
      episodes: [],
      decisions: { pending: [], resolved: [] }
    });
  }
}

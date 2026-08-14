import { promises as fs } from "fs";
import { NextResponse } from "next/server";
import { logFile } from "@/lib/paths";
import type { LogEntry } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  let raw = "";
  try {
    raw = await fs.readFile(logFile(), "utf8");
  } catch {
    return NextResponse.json({ entries: [], total: 0 });
  }

  // Tolerant parse: skip blank and corrupt lines instead of failing the request.
  const entries: LogEntry[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        entries.push(parsed as LogEntry);
      }
    } catch {
      // corrupt line: ignore
    }
  }

  return NextResponse.json({ entries: entries.slice(-limit), total: entries.length });
}

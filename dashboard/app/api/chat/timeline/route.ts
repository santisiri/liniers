import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { artRoot, logFile } from "@/lib/paths";
import { isBusy, readConfig, readSession, readThread } from "@/lib/chatStore";
import type {
  TimelineChatItem,
  TimelineMedia,
  TimelineMilestoneItem,
  TimelinePayload
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/chat/timeline[?since=<ISO>] — fusión cronológica del chat del
 * director (pipeline/chat/thread.jsonl) con los hitos del estudio
 * (pipeline/log/conversations.jsonl, types artifact|decision|verdict|
 * question|handoff; status queda fuera). Los refs que son imagen/video bajo
 * art/ viajan enriquecidos con {url, model, status} desde el sidecar
 * .meta.json. Devuelve además busy y permissionMode. Parse tolerante.
 */

const MILESTONE_TYPES = new Set(["artifact", "decision", "verdict", "question", "handoff"]);

const MEDIA_KIND: Record<string, "image" | "video"> = {
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
  ".webp": "image",
  ".mp4": "video"
};

/** ref del log → media enriquecida si es un archivo imagen/video bajo art/. */
async function enrichRef(ref: string): Promise<TimelineMedia | null> {
  if (typeof ref !== "string" || !ref.startsWith("art/")) return null;
  const kind = MEDIA_KIND[path.extname(ref).toLowerCase()];
  if (!kind) return null;

  const base = path.resolve(artRoot());
  const rel = ref.slice("art/".length);
  const abs = path.resolve(base, rel);
  // Guard anti path-traversal: el ref debe quedar dentro de art/.
  if (abs !== base && !abs.startsWith(base + path.sep)) return null;

  try {
    const stat = await fs.stat(abs);
    if (!stat.isFile()) return null;
  } catch {
    return null;
  }

  let model: string | null = null;
  let status: string | null = null;
  try {
    const meta = JSON.parse(await fs.readFile(`${abs}.meta.json`, "utf8")) as unknown;
    if (meta && typeof meta === "object" && !Array.isArray(meta)) {
      const rec = meta as Record<string, unknown>;
      if (typeof rec.model === "string") model = rec.model;
      if (typeof rec.status === "string") status = rec.status;
    }
  } catch {
    // sin sidecar o corrupto: media sin metadata
  }

  return {
    ref,
    url: `/api/media/${rel.split("/").map(encodeURIComponent).join("/")}`,
    kind,
    model,
    status
  };
}

async function readMilestones(): Promise<TimelineMilestoneItem[]> {
  let raw = "";
  try {
    raw = await fs.readFile(logFile(), "utf8");
  } catch {
    return [];
  }

  const items: TimelineMilestoneItem[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let rec: Record<string, unknown>;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
      rec = parsed as Record<string, unknown>;
    } catch {
      continue; // línea corrupta
    }
    if (typeof rec.ts !== "string" || typeof rec.type !== "string") continue;
    if (!MILESTONE_TYPES.has(rec.type)) continue;

    const refs = Array.isArray(rec.refs)
      ? rec.refs.filter((r): r is string => typeof r === "string")
      : [];
    const mediaResults = await Promise.all(refs.map(enrichRef));
    const media = mediaResults.filter((m): m is TimelineMedia => m !== null);

    items.push({
      kind: "milestone",
      ts: rec.ts,
      agent: typeof rec.agent === "string" ? rec.agent : "?",
      type: rec.type,
      summary: typeof rec.summary === "string" ? rec.summary : "",
      refs,
      ...(typeof rec.to === "string" && rec.to ? { to: rec.to } : {}),
      media
    });
  }
  return items;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sinceRaw = url.searchParams.get("since");
  const since = sinceRaw ? Date.parse(sinceRaw) : NaN;

  const [thread, milestones, session, config] = await Promise.all([
    readThread(),
    readMilestones(),
    readSession(),
    readConfig()
  ]);

  const chatItems: TimelineChatItem[] = thread.map((msg) => ({
    kind: "chat",
    ts: msg.ts,
    role: msg.role,
    text: msg.text,
    ...(msg.turnId ? { turnId: msg.turnId } : {})
  }));

  let items = [...chatItems, ...milestones];
  if (!Number.isNaN(since)) {
    items = items.filter((item) => {
      const at = Date.parse(item.ts);
      return !Number.isNaN(at) && at > since;
    });
  }
  // Orden cronológico ascendente; empates: chat antes que hito.
  items.sort((a, b) => {
    const ta = Date.parse(a.ts);
    const tb = Date.parse(b.ts);
    const va = Number.isNaN(ta) ? 0 : ta;
    const vb = Number.isNaN(tb) ? 0 : tb;
    if (va !== vb) return va - vb;
    if (a.kind !== b.kind) return a.kind === "chat" ? -1 : 1;
    return 0;
  });

  const payload: TimelinePayload = {
    items,
    busy: isBusy(session),
    permissionMode: config.permissionMode
  };
  return NextResponse.json(payload);
}

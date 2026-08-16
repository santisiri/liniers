import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { liniersRoot, logFile } from "@/lib/paths";
import { agentColor, agentInitials } from "@/lib/constants";
import type { LogEntry } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Máximo de entradas de log consideradas al derivar el grafo. */
const MAX_LOG_ENTRIES = 5000;
/** Máximo de evidencia (entradas de log) devuelta por arista. */
const EVIDENCE_CAP = 20;
/** Máximo de entradas por agente y por archivo para vínculos suaves. */
const FILE_TOUCHES_CAP = 10;

/** Peso de cada mecanismo de vínculo dinámico. */
const WEIGHTS = { to: 3, mention: 2, file: 1 } as const;

type Via = keyof typeof WEIGHTS;
const VIA_PRIORITY: Record<Via, number> = { to: 3, mention: 2, file: 1 };

/**
 * Flujo estructural del pipeline según CLAUDE.md. Constantes: existen aunque
 * el log esté vacío. `key` se traduce en el cliente (map.struct.<key>).
 */
const STRUCTURAL_FLOW: Array<{ from: string; to: string; both?: boolean; key: string }> = [
  { from: "transcript-analyst", to: "episode-writer", key: "analysis" },
  { from: "episode-writer", to: "continuity-guardian", both: true, key: "continuity" },
  { from: "episode-writer", to: "storyboard-artist", key: "board" },
  { from: "storyboard-artist", to: "prompt-smith", key: "prompts" },
  { from: "prompt-smith", to: "render-producer", key: "render" },
  { from: "character-designer", to: "storyboard-artist", key: "chardesign" },
  { from: "episode-writer", to: "localizer", key: "localization" },
  ...[
    "transcript-analyst",
    "episode-writer",
    "continuity-guardian",
    "character-designer",
    "storyboard-artist",
    "prompt-smith",
    "localizer",
    "render-producer"
  ].map((creative) => ({
    from: "creative-director",
    to: creative,
    both: true,
    key: "direction"
  }))
];

interface EdgeEvidence {
  /** Índice de la entrada dentro del log parseado (estable en esta respuesta). */
  i: number;
  via: Via;
  file?: string;
  ts?: string;
  agent?: string;
  to?: string;
  type?: string;
  summary?: string;
  refs?: string[];
}

interface GraphEdge {
  id: string;
  /** Endpoints en orden canónico (a < b). */
  a: string;
  b: string;
  structural: { key: string; dir: "ab" | "ba" | "both" } | null;
  weight: number;
  counts: { to: number; mention: number; file: number };
  /** Conteo de eventos dirigidos a→b y b→a (to + mention). */
  dirs: { ab: number; ba: number };
  lastTs: string | null;
  evidence: EdgeEvidence[];
  evidenceTotal: number;
}

interface GraphNode {
  id: string;
  kind: "agent" | "system" | "guest";
  color: string;
  initials: string;
  total: number;
  lastTs: string | null;
  degree: number;
}

async function readLogEntries(): Promise<LogEntry[]> {
  let raw = "";
  try {
    raw = await fs.readFile(logFile(), "utf8");
  } catch {
    return [];
  }
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
      // línea corrupta: se ignora
    }
  }
  return entries.slice(-MAX_LOG_ENTRIES);
}

async function readRosterSlugs(): Promise<string[]> {
  const dir = path.join(liniersRoot(), ".claude", "agents");
  let files: string[] = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith(".md")).sort();
  } catch {
    return [];
  }
  const slugs: string[] = [];
  for (const file of files) {
    try {
      const md = await fs.readFile(path.join(dir, file), "utf8");
      const name = /^---\r?\n[\s\S]*?^name:\s*(.+?)\s*$/m.exec(md)?.[1];
      slugs.push(name ?? file.replace(/\.md$/, ""));
    } catch {
      // ilegible: se salta
    }
  }
  return slugs;
}

function pairId(x: string, y: string): { id: string; a: string; b: string } {
  const [a, b] = x < y ? [x, y] : [y, x];
  return { id: `${a}|${b}`, a, b };
}

function normalizeRef(ref: unknown): string | null {
  if (typeof ref !== "string") return null;
  const cleaned = ref.trim().replace(/^\.\//, "").replace(/\/+$/, "");
  return cleaned.length > 0 ? cleaned : null;
}

export async function GET() {
  const [rosterSlugs, entries] = await Promise.all([readRosterSlugs(), readLogEntries()]);
  const roster = new Set(rosterSlugs);

  // --- universo de agentes conocidos (roster + studio + los que hablan o reciben)
  const known = new Set<string>(["studio", ...rosterSlugs]);
  for (const e of entries) {
    if (typeof e.agent === "string" && e.agent) known.add(e.agent);
    if (typeof e.to === "string" && e.to) known.add(e.to);
  }

  const edges = new Map<
    string,
    GraphEdge & { rawEvidence: Array<{ i: number; via: Via; file?: string }> }
  >();

  const getEdge = (x: string, y: string) => {
    const { id, a, b } = pairId(x, y);
    let edge = edges.get(id);
    if (!edge) {
      edge = {
        id,
        a,
        b,
        structural: null,
        weight: 0,
        counts: { to: 0, mention: 0, file: 0 },
        dirs: { ab: 0, ba: 0 },
        lastTs: null,
        evidence: [],
        evidenceTotal: 0,
        rawEvidence: []
      };
      edges.set(id, edge);
    }
    return edge;
  };

  // --- (a) aristas estructurales: el flujo diseñado del pipeline
  for (const flow of STRUCTURAL_FLOW) {
    const edge = getEdge(flow.from, flow.to);
    const dir: "ab" | "ba" | "both" = flow.both
      ? "both"
      : edge.a === flow.from
        ? "ab"
        : "ba";
    // La primera definición gana (no hay pares duplicados en la constante).
    if (!edge.structural) edge.structural = { key: flow.key, dir };
    known.add(flow.from);
    known.add(flow.to);
  }

  // Regex de mención por slug conocido (límites que excluyen [a-z0-9-]).
  const mentionable = [...known].filter((slug) => slug.length >= 3);
  const mentionRegex = new Map<string, RegExp>();
  for (const slug of mentionable) {
    const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    mentionRegex.set(slug, new RegExp(`(^|[^a-z0-9-])${escaped}($|[^a-z0-9-])`, "i"));
  }

  const addDynamic = (
    from: string,
    to: string,
    via: Via,
    i: number,
    ts: string | undefined,
    file?: string
  ) => {
    if (from === to) return;
    const edge = getEdge(from, to);
    edge.counts[via] += 1;
    edge.weight += WEIGHTS[via];
    if (via !== "file") {
      if (edge.a === from) edge.dirs.ab += 1;
      else edge.dirs.ba += 1;
    }
    if (ts && (!edge.lastTs || ts > edge.lastTs)) edge.lastTs = ts;
    edge.rawEvidence.push({ i, via, file });
  };

  // --- (b) dinámicas explícitas: campo "to" y menciones en el summary
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const agent = typeof e.agent === "string" ? e.agent : null;
    if (!agent) continue;
    const ts = typeof e.ts === "string" ? e.ts : undefined;

    if (typeof e.to === "string" && e.to && e.to !== agent) {
      addDynamic(agent, e.to, "to", i, ts);
    }

    const summary = typeof e.summary === "string" ? e.summary : "";
    if (summary) {
      for (const [slug, regex] of mentionRegex) {
        if (slug === agent) continue;
        if (slug === e.to) continue; // ya contado como "to"
        if (regex.test(summary)) addDynamic(agent, slug, "mention", i, ts);
      }
    }
  }

  // --- (c) dinámicas suaves: dos agentes tocaron el mismo archivo en refs
  const fileTouches = new Map<string, Map<string, Array<{ i: number; ts?: string }>>>();
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const agent = typeof e.agent === "string" ? e.agent : null;
    if (!agent || !Array.isArray(e.refs)) continue;
    const ts = typeof e.ts === "string" ? e.ts : undefined;
    const uniqueRefs = new Set<string>();
    for (const raw of e.refs) {
      const ref = normalizeRef(raw);
      if (ref) uniqueRefs.add(ref);
    }
    for (const ref of uniqueRefs) {
      let byAgent = fileTouches.get(ref);
      if (!byAgent) {
        byAgent = new Map();
        fileTouches.set(ref, byAgent);
      }
      let touches = byAgent.get(agent);
      if (!touches) {
        touches = [];
        byAgent.set(agent, touches);
      }
      touches.push({ i, ts });
      if (touches.length > FILE_TOUCHES_CAP) touches.shift();
    }
  }
  for (const [ref, byAgent] of fileTouches) {
    if (byAgent.size < 2) continue;
    const agents = [...byAgent.keys()];
    for (let x = 0; x < agents.length; x++) {
      for (let y = x + 1; y < agents.length; y++) {
        // Un vínculo suave por par y por archivo; evidencia = últimos toques de cada uno.
        const edge = getEdge(agents[x], agents[y]);
        edge.counts.file += 1;
        edge.weight += WEIGHTS.file;
        for (const who of [agents[x], agents[y]]) {
          const touches = byAgent.get(who) ?? [];
          for (const touch of touches.slice(-3)) {
            edge.rawEvidence.push({ i: touch.i, via: "file", file: ref });
            if (touch.ts && (!edge.lastTs || touch.ts > edge.lastTs)) {
              edge.lastTs = touch.ts;
            }
          }
        }
      }
    }
  }

  // --- consolidar evidencia por arista: dedupe por entrada, cap, denormalizar
  const finalEdges: GraphEdge[] = [];
  for (const edge of edges.values()) {
    const byEntry = new Map<number, { i: number; via: Via; file?: string }>();
    for (const ev of edge.rawEvidence) {
      const prev = byEntry.get(ev.i);
      if (!prev || VIA_PRIORITY[ev.via] > VIA_PRIORITY[prev.via]) byEntry.set(ev.i, ev);
    }
    const deduped = [...byEntry.values()].sort((p, q) => p.i - q.i);
    const capped = deduped.slice(-EVIDENCE_CAP);
    const evidence: EdgeEvidence[] = capped.map((ev) => {
      const e = entries[ev.i] ?? {};
      return {
        i: ev.i,
        via: ev.via,
        ...(ev.file ? { file: ev.file } : {}),
        ts: typeof e.ts === "string" ? e.ts : undefined,
        agent: typeof e.agent === "string" ? e.agent : undefined,
        to: typeof e.to === "string" ? e.to : undefined,
        type: typeof e.type === "string" ? e.type : undefined,
        summary: typeof e.summary === "string" ? e.summary : undefined,
        refs: Array.isArray(e.refs) ? e.refs.map(String) : undefined
      };
    });
    const { rawEvidence: _raw, ...rest } = edge;
    finalEdges.push({ ...rest, evidence, evidenceTotal: deduped.length });
  }
  finalEdges.sort((p, q) => q.weight - p.weight);

  // --- nodos con actividad y grado
  const totals = new Map<string, { total: number; lastTs: string | null }>();
  for (const e of entries) {
    const agent = typeof e.agent === "string" ? e.agent : null;
    if (!agent) continue;
    const t = totals.get(agent) ?? { total: 0, lastTs: null };
    t.total += 1;
    if (typeof e.ts === "string" && (!t.lastTs || e.ts > t.lastTs)) t.lastTs = e.ts;
    totals.set(agent, t);
  }
  const degree = new Map<string, number>();
  for (const edge of finalEdges) {
    degree.set(edge.a, (degree.get(edge.a) ?? 0) + 1);
    degree.set(edge.b, (degree.get(edge.b) ?? 0) + 1);
  }

  const nodes: GraphNode[] = [...known].map((id) => ({
    id,
    kind: id === "studio" ? "system" : roster.has(id) ? "agent" : "guest",
    color: agentColor(id),
    initials: agentInitials(id),
    total: totals.get(id)?.total ?? 0,
    lastTs: totals.get(id)?.lastTs ?? null,
    degree: degree.get(id) ?? 0
  }));

  return NextResponse.json({
    nodes,
    edges: finalEdges,
    logTotal: entries.length,
    generatedAt: new Date().toISOString()
  });
}

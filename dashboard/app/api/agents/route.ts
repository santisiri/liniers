import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { liniersRoot, logFile } from "@/lib/paths";
import { agentColor, agentInitials } from "@/lib/constants";
import type { LogEntry } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Máximo de entradas de log consideradas (protege contra logs enormes). */
const MAX_LOG_ENTRIES = 5000;
/** Entradas recientes incluidas por agente en el perfil. */
const RECENT_PER_AGENT = 8;

interface AgentStats {
  total: number;
  byType: Record<string, number>;
  lastTs: string | null;
  recent: LogEntry[];
}

interface AgentInfo {
  slug: string;
  /** "agent" = roster (.claude/agents), "system" = studio, "guest" = solo aparece en el log. */
  kind: "agent" | "system" | "guest";
  description: string | null;
  role: string | null;
  color: string;
  initials: string;
  stats: AgentStats | null;
}

/** Parse tolerante del JSONL de conversaciones (misma política que /api/log). */
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

/** name + description del frontmatter YAML de un .md de agente. */
function parseFrontmatter(md: string): { name: string | null; description: string | null } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md);
  if (!match) return { name: null, description: null };
  const out: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return { name: out.name ?? null, description: out.description ?? null };
}

/** Roles de una línea de la tabla "El estudio: agentes" de CLAUDE.md. */
async function readRolesFromClaudeMd(): Promise<Record<string, string>> {
  const roles: Record<string, string> = {};
  try {
    const md = await fs.readFile(path.join(liniersRoot(), "CLAUDE.md"), "utf8");
    for (const line of md.split(/\r?\n/)) {
      const row = /^\|\s*`([a-z0-9-]+)`\s*\|\s*(.+?)\s*\|\s*$/.exec(line);
      if (row) roles[row[1]] = row[2];
    }
  } catch {
    // sin CLAUDE.md: roles vacíos
  }
  return roles;
}

/** Slugs + descripciones del roster en .claude/agents/*.md (orden alfabético estable). */
async function readRoster(): Promise<Array<{ slug: string; description: string | null }>> {
  const dir = path.join(liniersRoot(), ".claude", "agents");
  let files: string[] = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith(".md")).sort();
  } catch {
    return [];
  }
  const roster: Array<{ slug: string; description: string | null }> = [];
  for (const file of files) {
    try {
      const md = await fs.readFile(path.join(dir, file), "utf8");
      const { name, description } = parseFrontmatter(md);
      const slug = name ?? file.replace(/\.md$/, "");
      roster.push({ slug, description });
    } catch {
      // archivo ilegible: se salta
    }
  }
  return roster;
}

function buildStats(entries: LogEntry[]): Map<string, AgentStats> {
  const stats = new Map<string, AgentStats>();
  for (const entry of entries) {
    const agent = typeof entry.agent === "string" ? entry.agent : null;
    if (!agent) continue;
    let s = stats.get(agent);
    if (!s) {
      s = { total: 0, byType: {}, lastTs: null, recent: [] };
      stats.set(agent, s);
    }
    s.total += 1;
    const type = typeof entry.type === "string" ? entry.type : "unknown";
    s.byType[type] = (s.byType[type] ?? 0) + 1;
    if (typeof entry.ts === "string" && (!s.lastTs || entry.ts > s.lastTs)) {
      s.lastTs = entry.ts;
    }
    s.recent.push(entry);
    if (s.recent.length > RECENT_PER_AGENT) s.recent.shift();
  }
  return stats;
}

export async function GET() {
  const [roster, roles, entries] = await Promise.all([
    readRoster(),
    readRolesFromClaudeMd(),
    readLogEntries()
  ]);
  const stats = buildStats(entries);

  const agents: AgentInfo[] = [];
  const seen = new Set<string>();

  // Nodo sistema: el estudio mismo (orquestador).
  agents.push({
    slug: "studio",
    kind: "system",
    description: null,
    role: roles.studio ?? null,
    color: agentColor("studio"),
    initials: agentInitials("studio"),
    stats: stats.get("studio") ?? null
  });
  seen.add("studio");

  for (const { slug, description } of roster) {
    if (seen.has(slug)) continue;
    seen.add(slug);
    agents.push({
      slug,
      kind: "agent",
      description,
      role: roles[slug] ?? null,
      color: agentColor(slug),
      initials: agentInitials(slug),
      stats: stats.get(slug) ?? null
    });
  }

  // Agentes que aparecen en el log pero no están en el roster (invitados).
  const guests = [...stats.keys()].filter((slug) => !seen.has(slug)).sort();
  for (const slug of guests) {
    agents.push({
      slug,
      kind: "guest",
      description: null,
      role: roles[slug] ?? null,
      color: agentColor(slug),
      initials: agentInitials(slug),
      stats: stats.get(slug) ?? null
    });
  }

  return NextResponse.json({
    agents,
    logTotal: entries.length,
    generatedAt: new Date().toISOString()
  });
}

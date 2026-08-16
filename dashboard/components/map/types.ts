/** Shapes de /api/agents y /api/graph consumidos por el mapa. */

import type { LogEntry } from "@/lib/types";

export type NodeKind = "agent" | "system" | "guest";
export type EdgeVia = "to" | "mention" | "file";

export interface AgentStats {
  total: number;
  byType: Record<string, number>;
  lastTs: string | null;
  recent: LogEntry[];
}

export interface AgentInfo {
  slug: string;
  kind: NodeKind;
  description: string | null;
  role: string | null;
  color: string;
  initials: string;
  stats: AgentStats | null;
}

export interface AgentsPayload {
  agents: AgentInfo[];
  logTotal: number;
  generatedAt: string;
}

export interface GraphNode {
  id: string;
  kind: NodeKind;
  color: string;
  initials: string;
  total: number;
  lastTs: string | null;
  degree: number;
}

export interface EdgeEvidence {
  i: number;
  via: EdgeVia;
  file?: string;
  ts?: string;
  agent?: string;
  to?: string;
  type?: string;
  summary?: string;
  refs?: string[];
}

export interface GraphEdge {
  id: string;
  a: string;
  b: string;
  structural: { key: string; dir: "ab" | "ba" | "both" } | null;
  weight: number;
  counts: { to: number; mention: number; file: number };
  dirs: { ab: number; ba: number };
  lastTs: string | null;
  evidence: EdgeEvidence[];
  evidenceTotal: number;
}

export interface GraphPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
  logTotal: number;
  generatedAt: string;
}

"use client";

import React, { useMemo, useState } from "react";
import { useData } from "@/lib/useData";
import { useI18n } from "@/lib/i18n";
import { agentColor, LOG_TYPE_COLORS } from "@/lib/constants";
import { CENTER, edgeCurve, edgeWidth, ringPos, VIEW, type Pt } from "./map/geometry";
import type {
  AgentInfo,
  AgentsPayload,
  EdgeEvidence,
  GraphEdge,
  GraphNode,
  GraphPayload
} from "./map/types";
import styles from "./map/AgentMap.module.css";

/** Umbral de "actividad reciente" para el pulso (ms). */
const RECENT_MS = 10 * 60 * 1000;

/** Orden canónico del anillo: sigue el flujo del pipeline; el resto se apendea. */
const RING_ORDER = [
  "transcript-analyst",
  "episode-writer",
  "continuity-guardian",
  "localizer",
  "storyboard-artist",
  "prompt-smith",
  "render-producer",
  "character-designer",
  "creative-director"
];

const NODE_RADIUS: Record<GraphNode["kind"], number> = {
  system: 26,
  agent: 21,
  guest: 16
};

const KNOWN_TYPES = new Set(["status", "question", "decision", "artifact", "handoff", "verdict"]);

type Selection =
  | { kind: "node"; id: string }
  | { kind: "edge"; id: string; from?: string }
  | null;

type Hover = { kind: "node"; id: string } | { kind: "edge"; id: string } | null;

function isRecent(ts: string | null | undefined, now: number): boolean {
  if (!ts) return false;
  const t = Date.parse(ts);
  return Number.isFinite(t) && now - t < RECENT_MS;
}

function gradId(edgeId: string): string {
  return `mapgrad-${edgeId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

/** Badge de tipo de entrada, consistente con la vista Conversaciones. */
function TypeBadge({ type, t }: { type: string | undefined; t: (k: string) => string }) {
  if (!type) return null;
  const color = LOG_TYPE_COLORS[type] ?? "#8b93a3";
  const label = KNOWN_TYPES.has(type) ? t(`logTypes.${type}`) : type;
  return (
    <span
      className="type-badge"
      style={{ color, borderColor: `${color}55`, background: `${color}14` }}
    >
      {label}
    </span>
  );
}

export function AgentMapView() {
  const { t, fmtDateTime } = useI18n();
  const { data: agentsData, loading: agentsLoading, failed: agentsFailed } =
    useData<AgentsPayload>("/api/agents", 5000);
  const { data: graphData, loading: graphLoading, failed: graphFailed } =
    useData<GraphPayload>("/api/graph", 5000);

  const [selection, setSelection] = useState<Selection>(null);
  const [hover, setHover] = useState<Hover>(null);

  const nodes = useMemo(() => graphData?.nodes ?? [], [graphData]);
  const edges = useMemo(() => graphData?.edges ?? [], [graphData]);
  const agentsBySlug = useMemo(() => {
    const map = new Map<string, AgentInfo>();
    for (const a of agentsData?.agents ?? []) map.set(a.slug, a);
    return map;
  }, [agentsData]);

  // --- layout: studio al centro, el resto en el anillo en orden canónico
  const positions = useMemo(() => {
    const pos = new Map<string, { pt: Pt; r: number }>();
    const ring = nodes.filter((n) => n.id !== "studio");
    const ordered = [
      ...RING_ORDER.filter((id) => ring.some((n) => n.id === id)),
      ...ring
        .filter((n) => !RING_ORDER.includes(n.id))
        .map((n) => n.id)
        .sort()
    ];
    ordered.forEach((id, i) => {
      const node = ring.find((n) => n.id === id);
      if (node) pos.set(id, { pt: ringPos(i, ordered.length), r: NODE_RADIUS[node.kind] });
    });
    const studio = nodes.find((n) => n.id === "studio");
    if (studio) pos.set("studio", { pt: CENTER, r: NODE_RADIUS.system });
    return pos;
  }, [nodes]);

  const edgesByNode = useMemo(() => {
    const map = new Map<string, GraphEdge[]>();
    for (const edge of edges) {
      for (const end of [edge.a, edge.b]) {
        const list = map.get(end) ?? [];
        list.push(edge);
        map.set(end, list);
      }
    }
    for (const list of map.values()) list.sort((p, q) => q.weight - p.weight);
    return map;
  }, [edges]);

  // --- foco (hover manda; si no hay, la selección): vecinos nítidos, resto atenuado
  const focus = useMemo(() => {
    const f = hover ?? selection;
    if (!f) return null;
    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();
    if (f.kind === "node") {
      nodeIds.add(f.id);
      for (const edge of edgesByNode.get(f.id) ?? []) {
        edgeIds.add(edge.id);
        nodeIds.add(edge.a);
        nodeIds.add(edge.b);
      }
    } else {
      const edge = edges.find((e) => e.id === f.id);
      if (!edge) return null;
      edgeIds.add(edge.id);
      nodeIds.add(edge.a);
      nodeIds.add(edge.b);
    }
    return { nodeIds, edgeIds };
  }, [hover, selection, edges, edgesByNode]);

  const now = Date.now();
  const selectedEdge =
    selection?.kind === "edge" ? edges.find((e) => e.id === selection.id) ?? null : null;
  const selectedNode =
    selection?.kind === "node" ? nodes.find((n) => n.id === selection.id) ?? null : null;

  const selectEdge = (id: string, from?: string) => setSelection({ kind: "edge", id, from });

  // Orden de dibujo: estructurales puras al fondo, dinámicas por peso ascendente.
  const drawOrder = useMemo(() => {
    const structural = edges.filter((e) => e.weight === 0);
    const dynamic = [...edges.filter((e) => e.weight > 0)].sort((p, q) => p.weight - q.weight);
    return [...structural, ...dynamic];
  }, [edges]);

  const loading = (agentsLoading || graphLoading) && (!agentsData || !graphData);
  const failed = (agentsFailed || graphFailed) && (!agentsData || !graphData);

  return (
    <section className="panel">
      <h3 className="panel-title">
        {t("map.title")}
        <span className="live-row">
          <span className="live-dot" />
          {t("map.live")}
        </span>
      </h3>

      {loading && <p className="empty">{t("common.loading")}</p>}
      {failed && !loading && <p className="empty">{t("common.loadError")}</p>}

      {graphData && (
        <div className={styles.layout}>
          <div className={styles.mapBox}>
            {graphData.logTotal === 0 && <p className="hint">{t("map.empty")}</p>}
            <svg
              className={styles.mapSvg}
              viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
              role="img"
              aria-label={t("map.title")}
            >
              <defs>
                {drawOrder
                  .filter((e) => e.weight > 0)
                  .map((edge) => {
                    const a = positions.get(edge.a);
                    const b = positions.get(edge.b);
                    if (!a || !b) return null;
                    return (
                      <linearGradient
                        key={edge.id}
                        id={gradId(edge.id)}
                        gradientUnits="userSpaceOnUse"
                        x1={a.pt.x}
                        y1={a.pt.y}
                        x2={b.pt.x}
                        y2={b.pt.y}
                      >
                        <stop offset="0%" stopColor={agentColor(edge.a)} />
                        <stop offset="100%" stopColor={agentColor(edge.b)} />
                      </linearGradient>
                    );
                  })}
              </defs>

              {/* fondo: click despeja la selección */}
              <rect
                x={0}
                y={0}
                width={VIEW.w}
                height={VIEW.h}
                fill="transparent"
                onClick={() => setSelection(null)}
              />

              {/* anillo decorativo */}
              <circle
                cx={CENTER.x}
                cy={CENTER.y}
                r={240}
                fill="none"
                stroke="var(--border-soft)"
                strokeDasharray="1 7"
              />

              {/* aristas */}
              {drawOrder.map((edge) => {
                const a = positions.get(edge.a);
                const b = positions.get(edge.b);
                if (!a || !b) return null;
                const dimmed = focus !== null && !focus.edgeIds.has(edge.id);
                const isSelected = selection?.kind === "edge" && selection.id === edge.id;
                const hasDynamic = edge.weight > 0;

                const structuralCurve = edge.structural
                  ? edgeCurve(a.pt, a.r, b.pt, b.r, {
                      bowShift: hasDynamic ? -9 : 0,
                      arrowA: edge.structural.dir === "ba" || edge.structural.dir === "both",
                      arrowB: edge.structural.dir === "ab" || edge.structural.dir === "both"
                    })
                  : null;
                const dynamicCurve = hasDynamic
                  ? edgeCurve(a.pt, a.r, b.pt, b.r, {
                      bowShift: edge.structural ? 7 : 0,
                      arrowA: edge.dirs.ba > 0,
                      arrowB: edge.dirs.ab > 0
                    })
                  : null;
                const hitCurve = dynamicCurve ?? structuralCurve;
                const stroke = `url(#${gradId(edge.id)})`;

                return (
                  <g
                    key={edge.id}
                    className={`${styles.edge}${dimmed ? ` ${styles.dim}` : ""}`}
                  >
                    {structuralCurve && (
                      <>
                        <path
                          className={styles.edgePath}
                          d={structuralCurve.d}
                          stroke="var(--muted)"
                          strokeOpacity={isSelected ? 0.85 : 0.4}
                          strokeWidth={isSelected && !hasDynamic ? 1.8 : 1.1}
                          strokeDasharray="5 5"
                        />
                        {structuralCurve.arrowA && (
                          <polygon
                            points={structuralCurve.arrowA}
                            fill="var(--muted)"
                            opacity={0.55}
                          />
                        )}
                        {structuralCurve.arrowB && (
                          <polygon
                            points={structuralCurve.arrowB}
                            fill="var(--muted)"
                            opacity={0.55}
                          />
                        )}
                      </>
                    )}
                    {dynamicCurve && (
                      <>
                        <path
                          className={styles.edgePath}
                          d={dynamicCurve.d}
                          stroke={stroke}
                          strokeOpacity={isSelected ? 1 : 0.62}
                          strokeWidth={edgeWidth(edge.weight) + (isSelected ? 1 : 0)}
                          strokeLinecap="round"
                        />
                        {dynamicCurve.arrowA && (
                          <polygon points={dynamicCurve.arrowA} fill={agentColor(edge.a)} />
                        )}
                        {dynamicCurve.arrowB && (
                          <polygon points={dynamicCurve.arrowB} fill={agentColor(edge.b)} />
                        )}
                      </>
                    )}
                    {hitCurve && (
                      <path
                        className={styles.edgeHit}
                        d={hitCurve.d}
                        onClick={() => selectEdge(edge.id)}
                        onMouseEnter={() => setHover({ kind: "edge", id: edge.id })}
                        onMouseLeave={() => setHover(null)}
                      />
                    )}
                  </g>
                );
              })}

              {/* nodos */}
              {nodes.map((node) => {
                const placed = positions.get(node.id);
                if (!placed) return null;
                const { pt, r } = placed;
                const dimmed = focus !== null && !focus.nodeIds.has(node.id);
                const isSelected = selection?.kind === "node" && selection.id === node.id;
                const recent = isRecent(node.lastTs, now);
                const color = node.color;

                const isCenter = node.id === "studio";
                const out =
                  isCenter || (pt.x === CENTER.x && pt.y === CENTER.y)
                    ? { x: 0, y: 1 }
                    : {
                        x: (pt.x - CENTER.x) / Math.hypot(pt.x - CENTER.x, pt.y - CENTER.y),
                        y: (pt.y - CENTER.y) / Math.hypot(pt.x - CENTER.x, pt.y - CENTER.y)
                      };
                const labelPos = {
                  x: pt.x + out.x * (r + 15),
                  y: pt.y + out.y * (r + 15)
                };
                const anchor =
                  isCenter || Math.abs(out.x) < 0.35
                    ? "middle"
                    : out.x > 0
                      ? "start"
                      : "end";
                const labelDy = isCenter ? 12 : out.y > 0.35 ? 10 : out.y < -0.35 ? -2 : 4;

                return (
                  <g
                    key={node.id}
                    className={`${styles.node}${dimmed ? ` ${styles.dim}` : ""}${
                      isSelected ? ` ${styles.nodeSelected}` : ""
                    }`}
                    onClick={() => setSelection({ kind: "node", id: node.id })}
                    onMouseEnter={() => setHover({ kind: "node", id: node.id })}
                    onMouseLeave={() => setHover(null)}
                  >
                    {recent && (
                      <circle
                        className={styles.pulseHalo}
                        cx={pt.x}
                        cy={pt.y}
                        r={r + 7}
                        fill="none"
                        stroke={color}
                        strokeWidth={1.5}
                      />
                    )}
                    {recent && (
                      <circle cx={pt.x} cy={pt.y} r={r + 4} fill={color} opacity={0.14} />
                    )}
                    {isSelected && (
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={r + 5}
                        fill="none"
                        stroke="var(--amber)"
                        strokeWidth={1}
                        strokeDasharray="3 3"
                      />
                    )}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={r}
                      fill="var(--bg-deep)"
                      stroke={color}
                      strokeWidth={isSelected ? 2.4 : 1.5}
                    />
                    <text
                      className={styles.nodeInitials}
                      x={pt.x}
                      y={pt.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={color}
                    >
                      {node.initials}
                    </text>
                    <text
                      className={styles.nodeLabel}
                      x={labelPos.x}
                      y={labelPos.y}
                      dy={labelDy}
                      textAnchor={anchor}
                    >
                      {node.id}
                    </text>
                  </g>
                );
              })}
            </svg>

            <div className={styles.legend}>
              <span className={styles.legendItem}>
                <span className={`${styles.swatchLine} ${styles.swatchStructural}`} />
                {t("map.legend.structural")}
              </span>
              <span className={styles.legendItem}>
                <span className={styles.swatchLine} />
                {t("map.legend.dynamic")}
              </span>
              <span className={styles.legendItem}>
                <span className={styles.swatchRecent} />
                {t("map.legend.recent")}
              </span>
            </div>
            <div className={styles.statsRow}>
              <span className={styles.statChip}>
                <strong>{nodes.length}</strong> {t("map.stats.agents")}
              </span>
              <span className={styles.statChip}>
                <strong>{edges.length}</strong> {t("map.stats.links")}
              </span>
              <span className={styles.statChip}>
                <strong>{graphData.logTotal}</strong> {t("map.stats.entries")}
              </span>
            </div>
            <p className="hint" style={{ marginTop: 8 }}>
              {t("map.hint")}
            </p>
          </div>

          <aside className={styles.aside}>
            {selectedEdge ? (
              <PairPanel
                edge={selectedEdge}
                from={selection?.kind === "edge" ? selection.from : undefined}
                onBack={(nodeId) => setSelection({ kind: "node", id: nodeId })}
                t={t}
                fmtDateTime={fmtDateTime}
              />
            ) : selectedNode ? (
              <NodePanel
                node={selectedNode}
                agent={agentsBySlug.get(selectedNode.id) ?? null}
                connections={edgesByNode.get(selectedNode.id) ?? []}
                onSelectEdge={(id) => selectEdge(id, selectedNode.id)}
                t={t}
                fmtDateTime={fmtDateTime}
              />
            ) : (
              <p className={styles.asideEmpty}>{t("map.panel.placeholder")}</p>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ panel: agente */

interface NodePanelProps {
  node: GraphNode;
  agent: AgentInfo | null;
  connections: GraphEdge[];
  onSelectEdge: (edgeId: string) => void;
  t: (k: string) => string;
  fmtDateTime: (ts?: string | null) => string;
}

function NodePanel({ node, agent, connections, onSelectEdge, t, fmtDateTime }: NodePanelProps) {
  const color = node.color;
  const stats = agent?.stats ?? null;
  const role =
    agent?.role ??
    (node.kind === "system"
      ? t("map.role.system")
      : node.kind === "guest"
        ? t("map.role.guest")
        : null);
  const recent = stats ? [...stats.recent].reverse() : [];

  return (
    <div>
      <div className={styles.profileHead}>
        <span className="avatar" style={{ borderColor: color, color }} aria-hidden="true">
          {node.initials}
        </span>
        <div>
          <div className={styles.profileName} style={{ color }}>
            {node.id}
          </div>
          <span className={styles.kindTag}>{t(`map.kind.${node.kind}`)}</span>
        </div>
      </div>

      {role && <p className={styles.roleLine}>{role}</p>}
      {agent?.description && <p className={styles.desc}>{agent.description}</p>}

      <div className={styles.sectionLabel}>
        <span>
          {node.total} {t("map.panel.entries")}
        </span>
        {stats?.lastTs && (
          <span className={styles.lastSeen}>
            {t("map.panel.lastSeen")}: {fmtDateTime(stats.lastTs)}
          </span>
        )}
      </div>
      {stats && (
        <div className={styles.typeChips}>
          {Object.entries(stats.byType)
            .sort((p, q) => q[1] - p[1])
            .map(([type, count]) => (
              <span key={type} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <TypeBadge type={type} t={t} />
                <span className="mono" style={{ color: "var(--muted)", fontSize: 10.5 }}>
                  ×{count}
                </span>
              </span>
            ))}
        </div>
      )}

      <div className={styles.sectionLabel}>
        <span>{t("map.panel.connections")}</span>
      </div>
      {connections.length === 0 ? (
        <p className={styles.asideEmpty}>{t("map.panel.noConnections")}</p>
      ) : (
        <div className={styles.connList}>
          {connections.map((edge) => {
            const other = edge.a === node.id ? edge.b : edge.a;
            return (
              <button
                key={edge.id}
                type="button"
                className={styles.connBtn}
                onClick={() => onSelectEdge(edge.id)}
              >
                <span className={styles.connDot} style={{ background: agentColor(other) }} />
                <span className={styles.connName}>{other}</span>
                {edge.structural && (
                  <span className={styles.structDot} title={t(`map.struct.${edge.structural.key}`)}>
                    ◇
                  </span>
                )}
                <span className={styles.connMeta}>
                  {edge.weight > 0 ? `${t("map.pair.weight")} ${edge.weight}` : "—"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className={styles.sectionLabel}>
        <span>{t("map.panel.recentActivity")}</span>
      </div>
      {recent.length === 0 ? (
        <p className={styles.asideEmpty}>{t("map.panel.noActivity")}</p>
      ) : (
        <div className={styles.timeline}>
          {recent.map((entry, i) => (
            <article className={styles.tlEntry} key={`${entry.ts ?? ""}-${i}`}>
              <div className={styles.tlHead}>
                <TypeBadge type={typeof entry.type === "string" ? entry.type : undefined} t={t} />
                {typeof entry.to === "string" && entry.to && (
                  <span className={styles.tlTo}>→ {entry.to}</span>
                )}
                <span className={styles.tlTs}>{fmtDateTime(entry.ts)}</span>
              </div>
              <p className={styles.tlSummary}>{entry.summary ?? ""}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ panel: par */

interface PairPanelProps {
  edge: GraphEdge;
  from?: string;
  onBack: (nodeId: string) => void;
  t: (k: string) => string;
  fmtDateTime: (ts?: string | null) => string;
}

function PairPanel({ edge, from, onBack, t, fmtDateTime }: PairPanelProps) {
  const colorA = agentColor(edge.a);
  const colorB = agentColor(edge.b);
  const bidirectional =
    edge.structural?.dir === "both" || (edge.dirs.ab > 0 && edge.dirs.ba > 0);
  const arrow = bidirectional ? "↔" : edge.dirs.ba > 0 || edge.structural?.dir === "ba" ? "←" : "→";
  const evidence = [...edge.evidence].reverse();
  const capped = edge.evidenceTotal > edge.evidence.length;

  return (
    <div>
      {from && (
        <button type="button" className={styles.backBtn} onClick={() => onBack(from)}>
          ← {t("map.panel.back")}
        </button>
      )}
      <div className={styles.pairHead}>
        <span className={styles.pairName} style={{ color: colorA }}>
          {edge.a}
        </span>
        <span className={styles.pairArrow}>{arrow}</span>
        <span className={styles.pairName} style={{ color: colorB }}>
          {edge.b}
        </span>
      </div>

      <div className={styles.originChips}>
        {edge.structural && (
          <span className={`${styles.originChip} ${styles.originChipStructural}`}>
            {t(`map.struct.${edge.structural.key}`)}
          </span>
        )}
        {edge.counts.to > 0 && (
          <span className={styles.originChip}>
            {edge.counts.to}× {t("map.via.to")}
          </span>
        )}
        {edge.counts.mention > 0 && (
          <span className={styles.originChip}>
            {edge.counts.mention}× {t("map.via.mention")}
          </span>
        )}
        {edge.counts.file > 0 && (
          <span className={styles.originChip}>
            {edge.counts.file}× {t("map.via.file")}
          </span>
        )}
        {edge.weight > 0 && (
          <span className={styles.originChip}>
            {t("map.pair.weight")} {edge.weight}
          </span>
        )}
      </div>

      <div className={styles.sectionLabel}>
        <span>{t("map.pair.title")}</span>
      </div>

      {evidence.length === 0 ? (
        <p className={styles.asideEmpty}>{t("map.pair.empty")}</p>
      ) : (
        <div className={styles.timeline}>
          {evidence.map((ev: EdgeEvidence) => (
            <article className={styles.tlEntry} key={ev.i}>
              <div className={styles.tlHead}>
                <span className={styles.tlAgent} style={{ color: agentColor(ev.agent ?? "?") }}>
                  {ev.agent ?? "?"}
                </span>
                {ev.to && <span className={styles.tlTo}>→ {ev.to}</span>}
                <TypeBadge type={ev.type} t={t} />
                <span className={styles.tlTs}>{fmtDateTime(ev.ts)}</span>
              </div>
              <p className={styles.tlSummary}>{ev.summary ?? ""}</p>
              <div className={styles.tlRefs}>
                <span className={styles.viaTag}>
                  {t(`map.via.${ev.via}`)}
                  {ev.via === "file" && ev.file ? ":" : ""}
                </span>
                {ev.via === "file" && ev.file && <span className="ref-chip">{ev.file}</span>}
                {ev.refs &&
                  ev.refs.length > 0 &&
                  ev.via !== "file" &&
                  ev.refs.map((ref, ri) => (
                    <span className="ref-chip" key={`${ref}-${ri}`}>
                      {ref}
                    </span>
                  ))}
              </div>
            </article>
          ))}
        </div>
      )}

      {capped && (
        <p className={styles.capNote}>
          {t("map.pair.showing")
            .replace("{shown}", String(edge.evidence.length))
            .replace("{total}", String(edge.evidenceTotal))}
        </p>
      )}
    </div>
  );
}

"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import { useData } from "@/lib/useData";
import { agentColor, agentInitials, LOG_TYPE_COLORS } from "@/lib/constants";
import type { LogPayload } from "@/lib/types";

const KNOWN_TYPES = new Set([
  "status",
  "question",
  "decision",
  "artifact",
  "handoff",
  "verdict"
]);

export function ConversationsView() {
  const { t, fmtDateTime } = useI18n();
  const { data, loading, failed } = useData<LogPayload>("/api/log?limit=150", 3000);

  const entries = data?.entries ?? [];
  // Chronological feed, newest first.
  const feed = [...entries].reverse();

  return (
    <section className="panel">
      <h3 className="panel-title">
        {t("conversations.title")}
        <span className="live-row">
          <span className="live-dot" />
          {t("conversations.live")}
        </span>
      </h3>

      {loading && !data && <p className="empty">{t("common.loading")}</p>}
      {failed && !data && <p className="empty">{t("common.loadError")}</p>}
      {data && feed.length === 0 && (
        <p className="empty">{t("conversations.empty")}</p>
      )}

      {feed.length > 0 && (
        <div className="feed">
          {feed.map((entry, i) => {
            const agent = entry.agent ?? "?";
            const color = agentColor(agent);
            const type = entry.type ?? "";
            const typeColor = LOG_TYPE_COLORS[type] ?? "#8b93a3";
            const typeLabel = KNOWN_TYPES.has(type)
              ? t(`logTypes.${type}`)
              : type;
            return (
              <article className="feed-entry" key={`${entry.ts ?? ""}-${i}`}>
                <span
                  className="avatar"
                  style={{ borderColor: color, color }}
                  aria-hidden="true"
                >
                  {agentInitials(agent)}
                </span>
                <div>
                  <div className="feed-head">
                    <span className="feed-agent" style={{ color }}>
                      {agent}
                    </span>
                    {typeLabel && (
                      <span
                        className="type-badge"
                        style={{
                          color: typeColor,
                          borderColor: `${typeColor}55`,
                          background: `${typeColor}14`
                        }}
                      >
                        {typeLabel}
                      </span>
                    )}
                    <span className="feed-ts">{fmtDateTime(entry.ts)}</span>
                  </div>
                  <p className="feed-summary">{entry.summary ?? ""}</p>
                  {Array.isArray(entry.refs) && entry.refs.length > 0 && (
                    <div className="feed-refs">
                      {entry.refs.map((ref, ri) => (
                        <span className="ref-chip" key={`${ref}-${ri}`}>
                          {ref}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

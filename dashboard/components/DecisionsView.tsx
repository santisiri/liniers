"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import { useData } from "@/lib/useData";
import type { Decision, StateJson } from "@/lib/types";

function DecisionCard({
  decision,
  resolved
}: {
  decision: Decision;
  resolved: boolean;
}) {
  const { t, pick, fmtDate } = useI18n();
  const answer = decision.answer ?? decision.resolution;
  const resolvedAt = decision.resolvedAt ?? decision.ts;

  return (
    <article className={`decision-card${resolved ? " resolved" : ""}`}>
      <div className="decision-top">
        <span className="decision-topic">{decision.topic ?? ""}</span>
        <span className="decision-id">{decision.id ?? ""}</span>
        {decision.raisedBy && (
          <span className="decision-id">
            {t("decisions.raisedBy")}: {decision.raisedBy}
          </span>
        )}
      </div>
      <p className="decision-question">{pick(decision.question)}</p>
      {!resolved && Array.isArray(decision.options) && decision.options.length > 0 && (
        <div className="decision-foot">
          <span className="kv-label">{t("decisions.options")}</span>
          {decision.options.map((opt) => (
            <span className="option-chip" key={opt}>
              {opt}
            </span>
          ))}
        </div>
      )}
      {resolved && (
        <p className="decision-answer">
          <strong>{t("decisions.answer")}:</strong> {pick(answer) || "—"}
          {resolvedAt && (
            <>
              {" · "}
              {t("decisions.resolvedOn")} {fmtDate(String(resolvedAt))}
            </>
          )}
        </p>
      )}
    </article>
  );
}

export function DecisionsView() {
  const { t } = useI18n();
  const { data: state, loading, failed } = useData<StateJson>("/api/state", 10000);

  if (loading && !state) {
    return <section className="panel"><p className="empty">{t("common.loading")}</p></section>;
  }
  if (failed || !state) {
    return <section className="panel"><p className="empty">{t("common.loadError")}</p></section>;
  }

  const pending = state.decisions?.pending ?? [];
  const resolved = state.decisions?.resolved ?? [];

  return (
    <div className="two-col">
      <section className="panel">
        <h3 className="panel-title">
          {t("decisions.pendingTitle")}
          <span className="hint">{pending.length}</span>
        </h3>
        {pending.length === 0 ? (
          <p className="empty">{t("decisions.pendingEmpty")}</p>
        ) : (
          <div className="decision-list">
            {pending.map((d, i) => (
              <DecisionCard decision={d} resolved={false} key={d.id ?? i} />
            ))}
          </div>
        )}
      </section>
      <section className="panel">
        <h3 className="panel-title">
          {t("decisions.resolvedTitle")}
          <span className="hint">{resolved.length}</span>
        </h3>
        {resolved.length === 0 ? (
          <p className="empty">{t("decisions.resolvedEmpty")}</p>
        ) : (
          <div className="decision-list">
            {resolved.map((d, i) => (
              <DecisionCard decision={d} resolved key={d.id ?? i} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

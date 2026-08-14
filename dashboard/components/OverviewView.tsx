"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import { useData } from "@/lib/useData";
import { EPISODE_STATES, PHASES } from "@/lib/constants";
import type { StateJson } from "@/lib/types";
import type { TabId } from "@/components/Header";

interface OverviewProps {
  onNavigate: (tab: TabId) => void;
}

export function OverviewView({ onNavigate }: OverviewProps) {
  const { t, pick, fmtDateTime } = useI18n();
  const { data: state, loading, failed } = useData<StateJson>("/api/state", 10000);

  if (loading && !state) {
    return <section className="panel"><p className="empty">{t("common.loading")}</p></section>;
  }
  if (failed || !state) {
    return <section className="panel"><p className="empty">{t("common.loadError")}</p></section>;
  }

  const project = state.project ?? {};
  const phase = project.phase ?? "";
  const phaseIdx = (PHASES as readonly string[]).indexOf(phase);
  const episodes = state.episodes ?? [];
  const pending = state.decisions?.pending ?? [];

  return (
    <>
      <section className="panel overview-head">
        <div>
          <p className="kv-label">{t("overview.workingTitle")}</p>
          <h2 className="film-title">{pick(project.workingTitle) || "—"}</h2>
          <p className="film-logline">{pick(project.logline)}</p>
          <div className="meta-row">
            <div>
              <p className="kv-label">{t("overview.languages")}</p>
              <span className="mono">{(project.languages ?? []).join(" · ") || "—"}</span>
            </div>
            {state.updatedAt && (
              <div>
                <p className="kv-label">{t("common.updatedAt")}</p>
                <span className="mono">{fmtDateTime(state.updatedAt)}</span>
              </div>
            )}
          </div>
        </div>
        <div>
          <p className="kv-label">{t("overview.phaseTitle")}</p>
          <div className="stepper">
            {PHASES.map((p, i) => {
              const cls =
                i < phaseIdx ? "done" : i === phaseIdx ? "current" : "";
              return (
                <React.Fragment key={p}>
                  {i > 0 && (
                    <span
                      className={`step-line${i <= phaseIdx ? " done" : ""}`}
                    />
                  )}
                  <div className={`step ${cls}`}>
                    <span className="step-node" />
                    <span className="step-label">{t(`phases.${p}`)}</span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </section>

      <section className="panel">
        <h3 className="panel-title">{t("overview.episodesTitle")}</h3>
        {episodes.length === 0 ? (
          <p className="empty">{t("overview.episodesEmpty")}</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t("overview.colEpisode")}</th>
                <th>{t("overview.colTitle")}</th>
                <th>{t("overview.colState")}</th>
                <th>{t("overview.colPipeline")}</th>
              </tr>
            </thead>
            <tbody>
              {episodes.map((ep, i) => {
                const epState = (ep.state ?? ep.status ?? "") as string;
                const stateIdx = (EPISODE_STATES as readonly string[]).indexOf(
                  epState
                );
                return (
                  <tr key={ep.id ?? ep.slug ?? i}>
                    <td className="ep-id">{ep.id ?? ep.slug ?? `#${i + 1}`}</td>
                    <td>{pick(ep.title) || "—"}</td>
                    <td className="ep-state">
                      {stateIdx >= 0 ? t(`episodeStates.${epState}`) : epState || "—"}
                    </td>
                    <td>
                      <span className="ep-pipeline">
                        {EPISODE_STATES.map((s, si) => (
                          <span
                            key={s}
                            title={t(`episodeStates.${s}`)}
                            className={`pip${
                              si < stateIdx
                                ? " done"
                                : si === stateIdx
                                  ? " current"
                                  : ""
                            }`}
                          />
                        ))}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="state-legend">
          <span className="hint">{t("overview.stateLegend")}</span>
          {EPISODE_STATES.map((s, i) => (
            <span key={s} className="legend-item">
              <span className="legend-index">{i + 1}</span>
              {t(`episodeStates.${s}`)}
            </span>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3 className="panel-title">{t("overview.decisionsTitle")}</h3>
        {pending.length === 0 ? (
          <p className="empty">{t("overview.decisionsEmpty")}</p>
        ) : (
          <div className="decision-list">
            {pending.map((d, i) => (
              <article className="decision-card" key={d.id ?? i}>
                <div className="decision-top">
                  <span className="decision-topic">{d.topic ?? ""}</span>
                  <span className="decision-id">{d.id ?? ""}</span>
                </div>
                <p className="decision-question">{pick(d.question)}</p>
                {Array.isArray(d.options) && d.options.length > 0 && (
                  <div className="decision-foot">
                    {d.options.map((opt) => (
                      <span className="option-chip" key={opt}>
                        {opt}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
        {pending.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <button
              type="button"
              className="link-btn"
              onClick={() => onNavigate("decisions")}
            >
              {t("overview.goToDecisions")}
            </button>
          </div>
        )}
      </section>
    </>
  );
}

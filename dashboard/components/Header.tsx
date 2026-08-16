"use client";

import React from "react";
import { useI18n, type Lang } from "@/lib/i18n";

export type TabId =
  | "overview"
  | "map"
  | "conversations"
  | "gallery"
  | "decisions"
  | "settings";

const TABS: TabId[] = ["overview", "map", "conversations", "gallery", "decisions", "settings"];
const LANGS: Lang[] = ["es", "en"];

function GearIcon() {
  return (
    <svg
      className="tab-icon"
      viewBox="0 0 24 24"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg
      className="tab-icon"
      viewBox="0 0 24 24"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="5" cy="6" r="2.6" />
      <circle cx="19" cy="6" r="2.6" />
      <circle cx="12" cy="18" r="2.6" />
      <path d="M7.3 7.4 10.6 16M16.7 7.4 13.4 16M7.6 6h8.8" />
    </svg>
  );
}

interface HeaderProps {
  active: TabId;
  onChange: (tab: TabId) => void;
  pendingDecisions: number;
}

export function Header({ active, onChange, pendingDecisions }: HeaderProps) {
  const { t, lang, setLang } = useI18n();

  return (
    <header className="site-header">
      <div className="header-inner">
        <div className="brand">
          <span className="brand-eyebrow">{t("app.eyebrow")}</span>
          <h1 className="brand-title">
            {t("app.brand")}
            <span className="brand-sep">·</span>
            <span className="brand-sub">{t("app.title")}</span>
          </h1>
        </div>
        <div className="lang-toggle" role="group" aria-label={t("lang.toggleLabel")}>
          {LANGS.map((code) => (
            <button
              key={code}
              type="button"
              className={lang === code ? "active" : ""}
              aria-pressed={lang === code}
              onClick={() => setLang(code)}
            >
              {t(`lang.${code}`)}
            </button>
          ))}
        </div>
      </div>
      <nav className="tabs">
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            className={`tab${active === id ? " active" : ""}`}
            onClick={() => onChange(id)}
          >
            {id === "map" && <MapIcon />}
            {id === "settings" && <GearIcon />}
            {t(`tabs.${id}`)}
            {id === "decisions" && pendingDecisions > 0 && (
              <span className="tab-count">{pendingDecisions}</span>
            )}
          </button>
        ))}
      </nav>
    </header>
  );
}

"use client";

import React from "react";
import { useI18n, type Lang } from "@/lib/i18n";

export type TabId = "overview" | "conversations" | "gallery" | "decisions";

const TABS: TabId[] = ["overview", "conversations", "gallery", "decisions"];
const LANGS: Lang[] = ["es", "en"];

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

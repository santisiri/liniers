"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface TierKey {
  set: boolean;
  last4?: string | null;
}

interface SettingsTier {
  id: string;
  purpose: string;
  provider: string | null;
  model: string | null;
  status: string;
  envKey: string;
  key: TierKey;
}

interface SettingsPayload {
  tiers: SettingsTier[];
}

const STATUS_CLASS: Record<string, string> = {
  configured: "st-configured",
  "mcp-default": "st-default",
  "pending-director": "st-pending"
};

function TierCard({
  tier,
  onChanged
}: {
  tier: SettingsTier;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState(tier.provider ?? "");
  const [model, setModel] = useState(tier.model ?? "");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msgKey: string } | null>(
    null
  );

  // Resincroniza los inputs cuando el servidor confirma un cambio (save/clear).
  useEffect(() => {
    setProvider(tier.provider ?? "");
    setModel(tier.model ?? "");
    setApiKey("");
  }, [tier.provider, tier.model, tier.status, tier.key.set]);

  const statusKey = `settings.status.${tier.status}`;
  const statusLabel = t(statusKey) === statusKey ? tier.status : t(statusKey);

  const keyPlaceholder = tier.key.set
    ? `••••••••${tier.key.last4 ?? ""}`
    : t("settings.keyPlaceholder");

  const save = async () => {
    const changes: Record<string, string> = {};
    const k = apiKey.trim();
    const p = provider.trim();
    const m = model.trim();
    if (k) changes.apiKey = k;
    if (p && p !== (tier.provider ?? "")) changes.provider = p;
    if (m && m !== (tier.model ?? "")) changes.model = m;
    if (Object.keys(changes).length === 0) {
      setFeedback({ ok: false, msgKey: "settings.nothingToSave" });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: tier.id, ...changes })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setFeedback({ ok: true, msgKey: "settings.saved" });
      onChanged();
    } catch {
      setFeedback({ ok: false, msgKey: "settings.error" });
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    if (!window.confirm(t("settings.confirmClear"))) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/settings?tier=${encodeURIComponent(tier.id)}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setFeedback({ ok: true, msgKey: "settings.cleared" });
      onChanged();
    } catch {
      setFeedback({ ok: false, msgKey: "settings.error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="tier-card">
      <div className="tier-head">
        <div>
          <h4 className="tier-name">{t(`settings.tiers.${tier.id}`)}</h4>
          <span className="mono tier-envkey">{tier.envKey}</span>
        </div>
        <span className={`tier-status ${STATUS_CLASS[tier.status] ?? ""}`}>
          {statusLabel}
        </span>
      </div>
      <p className="tier-purpose">{t(`settings.purpose.${tier.id}`)}</p>
      <div className="tier-form">
        <label className="field">
          <span className="kv-label">{t("settings.keyLabel")}</span>
          <input
            type="password"
            autoComplete="new-password"
            spellCheck={false}
            value={apiKey}
            placeholder={keyPlaceholder}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </label>
        <div className="field-row">
          <label className="field">
            <span className="kv-label">{t("settings.providerLabel")}</span>
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={provider}
              placeholder={t("settings.providerPlaceholder")}
              onChange={(e) => setProvider(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="kv-label">{t("settings.modelLabel")}</span>
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={model}
              placeholder={t("settings.modelPlaceholder")}
              onChange={(e) => setModel(e.target.value)}
            />
          </label>
        </div>
        <div className="tier-actions">
          <button
            type="button"
            className="link-btn"
            disabled={busy}
            onClick={() => void save()}
          >
            {t("settings.save")}
          </button>
          {tier.key.set && (
            <button
              type="button"
              className="link-btn danger"
              disabled={busy}
              onClick={() => void clear()}
            >
              {t("settings.clear")}
            </button>
          )}
          {feedback && (
            <span className={`feedback ${feedback.ok ? "ok" : "err"}`} role="status">
              {t(feedback.msgKey)}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

export function SettingsView() {
  const { t } = useI18n();
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as SettingsPayload;
      setData(json);
      setFailed(false);
    } catch {
      setData((prev) => {
        if (!prev) setFailed(true);
        return prev;
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <section className="panel">
        <p className="empty">{t("common.loading")}</p>
      </section>
    );
  }
  if (failed || !data) {
    return (
      <section className="panel">
        <p className="empty">{t("common.loadError")}</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h3 className="panel-title">
        {t("settings.title")}
        <span className="hint">{t("settings.subtitle")}</span>
      </h3>
      <p className="settings-note">{t("settings.note")}</p>
      <div className="settings-grid">
        {data.tiers.map((tier) => (
          <TierCard key={tier.id} tier={tier} onChanged={() => void load()} />
        ))}
      </div>
    </section>
  );
}

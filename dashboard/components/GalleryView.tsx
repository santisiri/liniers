"use client";

import React, { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useData } from "@/lib/useData";
import { ASSET_STATUS_COLORS, modelShort } from "@/lib/constants";
import type { GalleryItem, GalleryPayload } from "@/lib/types";

const KNOWN_STATUSES = new Set(["exploration", "candidate", "approved"]);

function StatusChip({ status }: { status: string }) {
  const { t } = useI18n();
  const color = ASSET_STATUS_COLORS[status] ?? "#8b93a3";
  const label = KNOWN_STATUSES.has(status) ? t(`assetStatus.${status}`) : status;
  return (
    <span
      className="status-chip"
      style={{
        color,
        borderColor: `${color}55`,
        background: `${color}14`
      }}
    >
      {label}
    </span>
  );
}

function AssetModal({
  item,
  onClose
}: {
  item: GalleryItem;
  onClose: () => void;
}) {
  const { t, fmtDateTime } = useI18n();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const meta = item.meta;
  const rows: Array<[string, React.ReactNode]> = [];
  if (meta) {
    if (meta.prompt)
      rows.push([
        t("gallery.meta.prompt"),
        <span className="meta-prompt" key="p">{String(meta.prompt)}</span>
      ]);
    if (meta.model)
      rows.push([t("gallery.meta.model"), <span className="mono" key="m">{String(meta.model)}</span>]);
    if (meta.agent)
      rows.push([t("gallery.meta.agent"), <span className="mono" key="a">{String(meta.agent)}</span>]);
    if (meta.status)
      rows.push([t("gallery.meta.status"), <StatusChip status={String(meta.status)} key="s" />]);
    if (meta.episode)
      rows.push([t("gallery.meta.episode"), <span className="mono" key="e">{String(meta.episode)}</span>]);
    if (meta.scene)
      rows.push([t("gallery.meta.scene"), <span className="mono" key="sc">{String(meta.scene)}</span>]);
    if (meta.shot)
      rows.push([t("gallery.meta.shot"), <span className="mono" key="sh">{String(meta.shot)}</span>]);
    if (meta.seed !== undefined && meta.seed !== null)
      rows.push([t("gallery.meta.seed"), <span className="mono" key="sd">{String(meta.seed)}</span>]);
    if (meta.ts)
      rows.push([t("gallery.meta.ts"), <span className="mono" key="t">{fmtDateTime(String(meta.ts))}</span>]);
  }
  rows.push([t("gallery.meta.file"), <span className="mono" key="f">{item.relPath}</span>]);

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-media">
          {item.kind === "video" ? (
            <video controls src={item.url} preload="metadata" />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={item.url} alt={item.name} />
          )}
        </div>
        <div className="modal-body">
          <div className="modal-head">
            <span className="modal-title">{item.name}</span>
            <button type="button" className="link-btn" onClick={onClose}>
              {t("common.close")}
            </button>
          </div>
          {!meta && <p className="hint">{t("gallery.noMeta")}</p>}
          <table className="meta-table">
            <tbody>
              {rows.map(([label, value], i) => (
                <tr key={i}>
                  <th>{label}</th>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function GalleryView() {
  const { t } = useI18n();
  const { data, loading, failed } = useData<GalleryPayload>("/api/gallery", 15000);
  const [selected, setSelected] = useState<GalleryItem | null>(null);

  if (loading && !data) {
    return <section className="panel"><p className="empty">{t("common.loading")}</p></section>;
  }
  if (failed || !data) {
    return <section className="panel"><p className="empty">{t("common.loadError")}</p></section>;
  }

  const total = data.categories.reduce((sum, c) => sum + c.count, 0);

  return (
    <section className="panel">
      <h3 className="panel-title">{t("gallery.title")}</h3>
      {total === 0 && <p className="empty">{t("gallery.empty")}</p>}
      {data.categories.map((cat) => (
        <div className="gallery-section" key={cat.id}>
          <h4 className="gallery-cat-title">
            {t(`gallery.categories.${cat.id}`)}
            <span className="gallery-cat-count">{cat.count}</span>
          </h4>
          {cat.count === 0 ? (
            <p className="hint" style={{ marginBottom: 18 }}>
              {t("gallery.categoryEmpty")}
            </p>
          ) : (
            cat.groups.map((group) => (
              <div key={group.episode ?? "general"}>
                <p className="gallery-episode">
                  {group.episode ?? t("gallery.general")}
                </p>
                <div className="asset-grid">
                  {group.items.map((item) => (
                    <button
                      type="button"
                      className="asset-card"
                      key={item.relPath}
                      onClick={() => setSelected(item)}
                    >
                      <span className="asset-media">
                        {item.kind === "video" ? (
                          <video src={item.url} preload="metadata" muted />
                        ) : (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={item.url} alt={item.name} loading="lazy" />
                        )}
                      </span>
                      <span className="asset-info">
                        <span className="asset-info-row">
                          <span className="asset-name">{item.name}</span>
                          {item.meta?.status && (
                            <StatusChip status={String(item.meta.status)} />
                          )}
                        </span>
                        {item.meta?.model && (
                          <span
                            className="model-chip"
                            title={String(item.meta.model)}
                          >
                            {modelShort(String(item.meta.model))}
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      ))}
      {selected && (
        <AssetModal item={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}

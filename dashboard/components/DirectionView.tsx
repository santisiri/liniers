"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import { useI18n } from "@/lib/i18n";
import { agentColor, agentInitials, LOG_TYPE_COLORS, modelShort } from "@/lib/constants";
import type {
  PermissionMode,
  TimelineChatItem,
  TimelineMedia,
  TimelineMilestoneItem,
  TimelinePayload
} from "@/lib/types";

const KNOWN_TYPES = new Set([
  "status",
  "question",
  "decision",
  "artifact",
  "handoff",
  "verdict"
]);

const POLL_MS = 2500;
/** Distancia al fondo (px) bajo la cual consideramos que el scroll está "pegado". */
const PIN_THRESHOLD = 48;

type Notice = "busy" | "sendError" | "modeError" | null;

// ------------------------------------------------------------------- icons

function MilestoneIcon({ type, color }: { type: string; color: string }) {
  const common = {
    width: 13,
    height: 13,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const
  };
  switch (type) {
    case "artifact":
      return (
        <svg {...common}>
          <path d="M21 8v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8M1 4h22v4H1zM10 12h4" />
        </svg>
      );
    case "decision":
      return (
        <svg {...common}>
          <path d="M12 2l9 10-9 10L3 12z" />
        </svg>
      );
    case "verdict":
      return (
        <svg {...common}>
          <path d="M20 6L9 17l-5-5" />
        </svg>
      );
    case "question":
      return (
        <svg {...common}>
          <path d="M9 9a3 3 0 1 1 4.6 2.5c-1 .7-1.6 1.4-1.6 2.5M12 17.5h.01" />
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
    case "handoff":
      return (
        <svg {...common}>
          <path d="M4 12h15M14 6l6 6-6 6" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
        </svg>
      );
  }
}

// ------------------------------------------------------------------ pieces

function MediaLightbox({
  media,
  onClose
}: {
  media: TimelineMedia;
  onClose: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-media">
          {media.kind === "video" ? (
            <video controls src={media.url} preload="metadata" />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={media.url} alt={media.ref} />
          )}
        </div>
        <div className="modal-body">
          <div className="modal-head">
            <span className="modal-title">{media.ref}</span>
            <button type="button" className="link-btn" onClick={onClose}>
              {t("common.close")}
            </button>
          </div>
          {media.model && (
            <p className="direction-media-model">
              <span className="kv-label">{t("gallery.meta.model")}</span>
              <span className="mono">{media.model}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function MilestoneCard({
  item,
  onOpenMedia
}: {
  item: TimelineMilestoneItem;
  onOpenMedia: (media: TimelineMedia) => void;
}) {
  const { t, fmtDateTime } = useI18n();
  const color = agentColor(item.agent);
  const typeColor = LOG_TYPE_COLORS[item.type] ?? "#8b93a3";
  const typeLabel = KNOWN_TYPES.has(item.type) ? t(`logTypes.${item.type}`) : item.type;
  const mediaRefs = new Set(item.media.map((m) => m.ref));
  const plainRefs = item.refs.filter((ref) => !mediaRefs.has(ref));

  return (
    <article className="milestone-card" style={{ borderLeftColor: typeColor }}>
      <div className="milestone-head">
        <MilestoneIcon type={item.type} color={typeColor} />
        <span className="feed-agent" style={{ color }}>
          {item.agent}
        </span>
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
        {item.to && (
          <span className="milestone-to">
            → <span style={{ color: agentColor(item.to) }}>{item.to}</span>
          </span>
        )}
        <span className="feed-ts">{fmtDateTime(item.ts)}</span>
      </div>
      <p className="milestone-summary">{item.summary}</p>
      {item.media.length > 0 && (
        <div className="milestone-media">
          {item.media.map((media) => (
            <button
              type="button"
              className="milestone-thumb"
              key={media.ref}
              onClick={() => onOpenMedia(media)}
              title={media.ref}
            >
              {media.kind === "video" ? (
                <video src={media.url} preload="metadata" muted />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={media.url} alt={media.ref} loading="lazy" />
              )}
              {media.model && (
                <span className="thumb-model-chip" title={media.model}>
                  {modelShort(media.model)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {plainRefs.length > 0 && (
        <div className="feed-refs">
          {plainRefs.map((ref, i) => (
            <span className="ref-chip" key={`${ref}-${i}`}>
              {ref}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

function ChatBubble({ item }: { item: TimelineChatItem }) {
  const { t, fmtDateTime } = useI18n();

  if (item.role === "system") {
    return (
      <div className="bubble-row system">
        <div className="bubble system">
          <span className="bubble-system-text">{item.text}</span>
          <span className="feed-ts">{fmtDateTime(item.ts)}</span>
        </div>
      </div>
    );
  }

  const isDirector = item.role === "director";
  const studioColor = agentColor("studio");
  return (
    <div className={`bubble-row ${isDirector ? "director" : "studio"}`}>
      {!isDirector && (
        <span
          className="avatar bubble-avatar"
          style={{ borderColor: studioColor, color: studioColor }}
          aria-hidden="true"
        >
          {agentInitials("studio")}
        </span>
      )}
      <div className={`bubble ${isDirector ? "director" : "studio"}`}>
        <div className="bubble-head">
          <span
            className="bubble-role"
            style={isDirector ? undefined : { color: studioColor }}
          >
            {t(`direction.roles.${item.role}`)}
          </span>
          <span className="feed-ts">{fmtDateTime(item.ts)}</span>
        </div>
        <p className="bubble-text">{item.text}</p>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------- view

export function DirectionView() {
  const { t } = useI18n();
  const [payload, setPayload] = useState<TimelinePayload | null>(null);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [lightbox, setLightbox] = useState<TimelineMedia | null>(null);

  const hasData = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pinnedRef = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/timeline", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as TimelinePayload;
      hasData.current = true;
      setPayload(json);
      setFailed(false);
    } catch {
      if (!hasData.current) setFailed(true);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const tick = () => {
      if (alive) void load();
    };
    tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [load]);

  const items = payload?.items ?? [];
  const busy = payload?.busy ?? false;
  const mode: PermissionMode = payload?.permissionMode ?? "default";
  const lastTs = items.length > 0 ? items[items.length - 1].ts : "";

  // Pegado al fondo solo si ya estaba al fondo antes del refresh.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight;
  }, [items.length, lastTs, busy]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < PIN_THRESHOLD;
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setNotice(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      if (res.status === 409) {
        setNotice("busy");
      } else if (!res.ok) {
        setNotice("sendError");
      } else {
        setDraft("");
        pinnedRef.current = true;
        await load();
      }
    } catch {
      setNotice("sendError");
    } finally {
      setSending(false);
    }
  };

  const onComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void send();
    }
  };

  const changeMode = async (next: PermissionMode) => {
    if (next === mode) return;
    if (next === "acceptEdits" && !window.confirm(t("direction.mode.confirmProduction"))) {
      return;
    }
    setNotice(null);
    try {
      const res = await fetch("/api/chat/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionMode: next })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch {
      setNotice("modeError");
    }
  };

  const modeBadgeClass = mode === "acceptEdits" ? "mode-badge production" : "mode-badge consult";
  const modeBadgeLabel =
    mode === "acceptEdits" ? t("direction.mode.badge.acceptEdits") : t("direction.mode.badge.default");

  return (
    <section className="panel">
      <h3 className="panel-title">
        {t("direction.title")}
        <span className="live-row">
          {busy ? (
            <>
              <span className="live-dot" />
              {t("direction.busy")}
            </>
          ) : (
            t("direction.live")
          )}
          <span className={modeBadgeClass}>{modeBadgeLabel}</span>
        </span>
      </h3>

      <p className="hint direction-transparency">{t("direction.transparency")}</p>

      {failed && !payload && <p className="empty">{t("common.loadError")}</p>}
      {!failed && !payload && <p className="empty">{t("common.loading")}</p>}

      {payload && (
        <>
          <div
            className="chat-scroll"
            ref={scrollRef}
            onScroll={onScroll}
            aria-live="polite"
          >
            {items.length === 0 ? (
              <div className="direction-empty">
                <p className="empty">{t("direction.empty")}</p>
                <p className="hint direction-empty-hint">{t("direction.emptyHint")}</p>
              </div>
            ) : (
              items.map((item, i) =>
                item.kind === "chat" ? (
                  <ChatBubble item={item} key={`c-${item.ts}-${i}`} />
                ) : (
                  <MilestoneCard
                    item={item}
                    onOpenMedia={setLightbox}
                    key={`m-${item.ts}-${i}`}
                  />
                )
              )
            )}
            {busy && (
              <div className="bubble-row system">
                <div className="working-indicator">
                  <span className="live-dot" />
                  {t("direction.busy")}
                </div>
              </div>
            )}
          </div>

          <div className="composer">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onComposerKeyDown}
              placeholder={t("direction.composer.placeholder")}
              rows={3}
              aria-label={t("direction.composer.placeholder")}
            />
            <div className="composer-row">
              <span className="hint">{t("direction.composer.hint")}</span>
              <span className="composer-actions">
                {notice === "busy" && (
                  <span className="feedback err">{t("direction.composer.busyBlocked")}</span>
                )}
                {notice === "sendError" && (
                  <span className="feedback err">{t("direction.composer.error")}</span>
                )}
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => void send()}
                  disabled={sending || busy || draft.trim() === ""}
                >
                  {t("direction.composer.send")}
                </button>
              </span>
            </div>
          </div>

          <div className="mode-panel">
            <p className="kv-label">{t("direction.mode.title")}</p>
            <div className="mode-options">
              <button
                type="button"
                className={`mode-option${mode === "default" ? " active" : ""}`}
                onClick={() => void changeMode("default")}
                aria-pressed={mode === "default"}
              >
                <span className="mode-option-name">{t("direction.mode.consult")}</span>
                <span className="mode-option-desc">{t("direction.mode.consultDesc")}</span>
              </button>
              <button
                type="button"
                className={`mode-option production${mode === "acceptEdits" ? " active" : ""}`}
                onClick={() => void changeMode("acceptEdits")}
                aria-pressed={mode === "acceptEdits"}
              >
                <span className="mode-option-name">{t("direction.mode.production")}</span>
                <span className="mode-option-desc">{t("direction.mode.productionDesc")}</span>
              </button>
            </div>
            {notice === "modeError" && (
              <span className="feedback err">{t("direction.mode.error")}</span>
            )}
          </div>
        </>
      )}

      {lightbox && <MediaLightbox media={lightbox} onClose={() => setLightbox(null)} />}
    </section>
  );
}

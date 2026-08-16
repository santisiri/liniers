/** A value that may be a plain string or a per-language map ({ es, en, ... }). */
export type Localized = string | { [lang: string]: string | undefined };

export interface EpisodeEntry {
  id?: string;
  slug?: string;
  title?: Localized;
  state?: string;
  status?: string;
  [key: string]: unknown;
}

export interface Decision {
  id?: string;
  topic?: string;
  question?: Localized;
  options?: string[];
  raisedBy?: string;
  status?: string;
  answer?: Localized;
  resolution?: Localized;
  resolvedAt?: string;
  ts?: string;
  [key: string]: unknown;
}

export interface StateJson {
  project?: {
    slug?: string;
    workingTitle?: Localized;
    logline?: Localized;
    languages?: string[];
    defaultLanguage?: string;
    phase?: string;
  };
  episodes?: EpisodeEntry[];
  decisions?: { pending?: Decision[]; resolved?: Decision[] };
  updatedAt?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  ts?: string;
  agent?: string;
  type?: string;
  summary?: string;
  refs?: string[];
  [key: string]: unknown;
}

export interface LogPayload {
  entries: LogEntry[];
  total: number;
}

export interface AssetMeta {
  prompt?: string;
  model?: string;
  agent?: string;
  status?: string;
  episode?: string;
  scene?: string;
  shot?: string;
  seed?: number | string;
  ts?: string;
  [key: string]: unknown;
}

export interface GalleryItem {
  name: string;
  relPath: string;
  url: string;
  kind: "image" | "video";
  episode: string | null;
  meta: AssetMeta | null;
}

export interface GalleryGroup {
  episode: string | null;
  items: GalleryItem[];
}

export interface GalleryCategory {
  id: string;
  count: number;
  groups: GalleryGroup[];
}

export interface GalleryPayload {
  categories: GalleryCategory[];
}

// ---------------------------------------------------------------- direction

/** Modo de permisos de la sesión headless del orquestador (default = seguro). */
export type PermissionMode = "default" | "acceptEdits";

export type ChatRole = "director" | "studio" | "system";

export interface ChatMessage {
  ts: string;
  role: ChatRole;
  text: string;
  turnId?: string;
}

/** Media enriquecida de un ref bajo art/ (imagen o video con sidecar). */
export interface TimelineMedia {
  ref: string;
  url: string;
  kind: "image" | "video";
  model: string | null;
  status: string | null;
}

export interface TimelineChatItem {
  kind: "chat";
  ts: string;
  role: ChatRole;
  text: string;
  turnId?: string;
}

export interface TimelineMilestoneItem {
  kind: "milestone";
  ts: string;
  agent: string;
  type: string;
  summary: string;
  refs: string[];
  to?: string;
  media: TimelineMedia[];
}

export type TimelineItem = TimelineChatItem | TimelineMilestoneItem;

export interface TimelinePayload {
  items: TimelineItem[];
  busy: boolean;
  permissionMode: PermissionMode;
}

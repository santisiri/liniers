export const PHASES = [
  "setup",
  "ingest",
  "bible",
  "characters",
  "episodes",
  "post"
] as const;

export const EPISODE_STATES = [
  "outline",
  "draft",
  "continuity_review",
  "approved",
  "storyboard",
  "prompts",
  "rendering",
  "done"
] as const;

export const GALLERY_CATEGORIES = ["characters", "storyboards", "renders"] as const;

/** Fixed palette for the studio's known agents; unknown agents get a hashed hue. */
export const AGENT_COLORS: Record<string, string> = {
  studio: "#d9a441",
  "creative-director": "#e6c37a",
  "transcript-analyst": "#6ea8c9",
  "episode-writer": "#b48ead",
  "continuity-guardian": "#a3be8c",
  "character-designer": "#d98ba0",
  "storyboard-artist": "#e0916f",
  "prompt-smith": "#8fd9c9",
  localizer: "#9aa7e0",
  "render-producer": "#bcc96e"
};

export const LOG_TYPE_COLORS: Record<string, string> = {
  status: "#8b93a3",
  question: "#d9a441",
  decision: "#b48ead",
  artifact: "#6ea8c9",
  handoff: "#8fd9c9",
  verdict: "#a3be8c"
};

export const ASSET_STATUS_COLORS: Record<string, string> = {
  exploration: "#8b93a3",
  candidate: "#d9a441",
  approved: "#a3be8c"
};

/** Deterministic muted color for agents not in the fixed palette. */
export function agentColor(agent: string): string {
  if (AGENT_COLORS[agent]) return AGENT_COLORS[agent];
  let hash = 0;
  for (let i = 0; i < agent.length; i++) {
    hash = (hash * 31 + agent.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue} 42% 66%)`;
}

/**
 * Short label for a model chip: "soul_2 (served as text2image_soul_v2, …)"
 * -> "soul_2". The full string belongs in the title attribute / modal.
 */
export function modelShort(model: string): string {
  const head = model.split(" (")[0].trim();
  return head || model;
}

/** Initials for the agent avatar: "continuity-guardian" -> "CG". */
export function agentInitials(agent: string): string {
  const parts = agent.split(/[-_.\s]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

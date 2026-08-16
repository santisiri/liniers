import { promises as fs } from "fs";
import path from "path";
import { liniersRoot } from "./paths";
import type { ChatMessage, ChatRole, PermissionMode } from "./types";

/**
 * Persistencia del canal de chat director ↔ orquestador (pipeline/chat/).
 *
 *   thread.jsonl   una línea por mensaje: {ts, role, text, turnId}
 *   session.json   {sessionId, updatedAt, busy} — sesión headless de Claude Code
 *   config.json    {permissionMode} — SIEMPRE nace en "default" (solo lectura /
 *                  conversación); únicamente el director humano lo eleva desde
 *                  la UI. El backend jamás lo eleva por su cuenta.
 *
 * Todo parse es tolerante: líneas corruptas se ignoran, archivos ausentes
 * equivalen a estado vacío. El directorio se crea al primer uso.
 */

export const PERMISSION_MODES: readonly PermissionMode[] = ["default", "acceptEdits"];

export const CHAT_ROLES: readonly ChatRole[] = ["director", "studio", "system"];

/** Un turno colgado deja de bloquear el canal pasado este margen (timeout 15 min + 1). */
const BUSY_STALE_MS = 16 * 60 * 1000;

export function chatDir(): string {
  return path.join(liniersRoot(), "pipeline", "chat");
}

export function threadFile(): string {
  return path.join(chatDir(), "thread.jsonl");
}

export function sessionFile(): string {
  return path.join(chatDir(), "session.json");
}

export function configFile(): string {
  return path.join(chatDir(), "config.json");
}

/** ISO-8601 UTC sin milisegundos (mismo formato que scripts/log.mjs). */
export function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

async function ensureChatDir(): Promise<void> {
  await fs.mkdir(chatDir(), { recursive: true });
}

// ------------------------------------------------------------------ thread

export async function appendMessage(msg: ChatMessage): Promise<void> {
  await ensureChatDir();
  await fs.appendFile(threadFile(), JSON.stringify(msg) + "\n", "utf8");
}

export async function readThread(): Promise<ChatMessage[]> {
  let raw = "";
  try {
    raw = await fs.readFile(threadFile(), "utf8");
  } catch {
    return [];
  }
  const out: ChatMessage[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
      const rec = parsed as Record<string, unknown>;
      if (typeof rec.ts !== "string" || typeof rec.text !== "string") continue;
      const role = (CHAT_ROLES as readonly string[]).includes(String(rec.role))
        ? (rec.role as ChatRole)
        : "system";
      out.push({
        ts: rec.ts,
        role,
        text: rec.text,
        turnId: typeof rec.turnId === "string" ? rec.turnId : undefined
      });
    } catch {
      // línea corrupta: se ignora
    }
  }
  return out;
}

// ----------------------------------------------------------------- session

export interface SessionState {
  sessionId: string | null;
  updatedAt: string | null;
  busy: boolean;
}

const EMPTY_SESSION: SessionState = { sessionId: null, updatedAt: null, busy: false };

export async function readSession(): Promise<SessionState> {
  try {
    const parsed = JSON.parse(await fs.readFile(sessionFile(), "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ...EMPTY_SESSION };
    }
    const rec = parsed as Record<string, unknown>;
    return {
      sessionId: typeof rec.sessionId === "string" && rec.sessionId ? rec.sessionId : null,
      updatedAt: typeof rec.updatedAt === "string" ? rec.updatedAt : null,
      busy: rec.busy === true
    };
  } catch {
    return { ...EMPTY_SESSION };
  }
}

export async function writeSession(patch: Partial<SessionState>): Promise<SessionState> {
  const current = await readSession();
  const next: SessionState = { ...current, ...patch, updatedAt: nowIso() };
  await ensureChatDir();
  await fs.writeFile(sessionFile(), JSON.stringify(next, null, 2) + "\n", "utf8");
  return next;
}

/**
 * busy efectivo: un flag busy sin updatedAt fresco (server caído a mitad de
 * turno) no debe bloquear el canal para siempre.
 */
export function isBusy(session: SessionState): boolean {
  if (!session.busy) return false;
  if (!session.updatedAt) return false;
  const at = Date.parse(session.updatedAt);
  if (Number.isNaN(at)) return false;
  return Date.now() - at < BUSY_STALE_MS;
}

// ------------------------------------------------------------------ config

export async function readConfig(): Promise<{ permissionMode: PermissionMode }> {
  try {
    const parsed = JSON.parse(await fs.readFile(configFile(), "utf8")) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const mode = (parsed as Record<string, unknown>).permissionMode;
      if (typeof mode === "string" && (PERMISSION_MODES as readonly string[]).includes(mode)) {
        return { permissionMode: mode as PermissionMode };
      }
    }
  } catch {
    // ausente o corrupto: default seguro
  }
  return { permissionMode: "default" };
}

export async function writeConfig(config: { permissionMode: PermissionMode }): Promise<void> {
  await ensureChatDir();
  await fs.writeFile(configFile(), JSON.stringify(config, null, 2) + "\n", "utf8");
}

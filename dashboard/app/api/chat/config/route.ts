import path from "path";
import { execFile } from "child_process";
import { NextResponse } from "next/server";
import { liniersRoot } from "@/lib/paths";
import { PERMISSION_MODES, readConfig, writeConfig } from "@/lib/chatStore";
import type { PermissionMode } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Config del modo de permisos del orquestador (pipeline/chat/config.json).
 *
 * GET   → { permissionMode } (default seguro: "default" si falta el archivo).
 * PATCH → { permissionMode: "default" | "acceptEdits" } valida el enum,
 *         persiste y loguea la decisión al log del estudio. Este endpoint es
 *         el ÚNICO camino de elevación y solo lo acciona el director humano
 *         desde el toggle de la vista Dirección.
 */

/** Log best-effort de la decisión — nunca bloquea ni falla el request. */
function logModeChange(mode: PermissionMode): void {
  const script = path.join(liniersRoot(), "scripts", "log.mjs");
  execFile(
    process.execPath,
    [script, "studio", "decision", `modo del orquestador → ${mode}`, "--to", "studio"],
    () => {
      /* best-effort */
    }
  );
}

export async function GET() {
  const config = await readConfig();
  return NextResponse.json(config);
}

export async function PATCH(request: Request) {
  let mode: unknown;
  try {
    const body = (await request.json()) as unknown;
    if (body && typeof body === "object" && !Array.isArray(body)) {
      mode = (body as Record<string, unknown>).permissionMode;
    }
  } catch {
    return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  }

  if (typeof mode !== "string" || !(PERMISSION_MODES as readonly string[]).includes(mode)) {
    return NextResponse.json({ error: "invalid-permission-mode" }, { status: 400 });
  }
  const permissionMode = mode as PermissionMode;

  const current = await readConfig();
  try {
    await writeConfig({ permissionMode });
  } catch {
    return NextResponse.json({ error: "write-failed" }, { status: 500 });
  }

  if (current.permissionMode !== permissionMode) {
    logModeChange(permissionMode);
  }

  return NextResponse.json({ ok: true, permissionMode });
}

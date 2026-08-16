import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { liniersRoot } from "@/lib/paths";
import {
  appendMessage,
  isBusy,
  nowIso,
  readConfig,
  readSession,
  writeSession
} from "@/lib/chatStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/chat { text } — turno del director hacia el orquestador.
 *
 * Appendea el mensaje del director a pipeline/chat/thread.jsonl, marca busy y
 * responde 202; el turno corre async: spawn de `claude -p --output-format json`
 * (primer turno sin --resume, siguientes con el sessionId guardado) con
 * cwd = raíz del repo y env heredado.
 *
 * MODELO DE PERMISOS (decisión de seguridad del proyecto): el spawn se lanza
 * SIN ningún flag de permisos — modo default de Claude Code, donde las acciones
 * que requieren aprobación simplemente se deniegan y el orquestador puede
 * conversar, leer el repo y reportar. El ÚNICO camino de elevación es
 * pipeline/chat/config.json {permissionMode:"acceptEdits"}, que solo cambia
 * cuando el director humano acciona el toggle en la UI; recién entonces se
 * agrega --permission-mode acceptEdits. Nunca se usa
 * --dangerously-skip-permissions ni ningún otro bypass.
 */

const TURN_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_TEXT_LENGTH = 20000;
const STDERR_EXCERPT = 400;

/**
 * Serializa la sección crítica del POST (chequeo de busy + append + marcado)
 * dentro de este proceso; el flag busy en session.json cubre el resto.
 */
let postChain: Promise<unknown> = Promise.resolve();
function withPostLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = postChain.then(fn, fn);
  postChain = next.catch(() => undefined);
  return next;
}

interface SpawnResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

function execClaude(args: string[]): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, {
      cwd: liniersRoot(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, TURN_TIMEOUT_MS);
    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString("utf8");
    });
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString("utf8");
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    });
  });
}

interface ParsedOutput {
  sessionId: string | null;
  text: string | null;
  isError: boolean;
}

/**
 * Parse tolerante del --output-format json del CLI: objeto único
 * ({type:"result", result, session_id, is_error}), array de mensajes, o
 * JSON en la última línea; si nada parsea, el stdout crudo es el texto.
 */
function parseClaudeOutput(stdout: string): ParsedOutput {
  const trimmed = stdout.trim();
  const parsed: unknown[] = [];
  if (trimmed) {
    try {
      parsed.push(JSON.parse(trimmed));
    } catch {
      for (const line of trimmed.split(/\r?\n/).reverse()) {
        const t = line.trim();
        if (!t) continue;
        try {
          parsed.push(JSON.parse(t));
          break;
        } catch {
          // no es JSON: seguir buscando
        }
      }
    }
  }

  const out: ParsedOutput = { sessionId: null, text: null, isError: false };
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const el of node) visit(el);
      return;
    }
    if (!node || typeof node !== "object") return;
    const rec = node as Record<string, unknown>;
    if (typeof rec.session_id === "string" && rec.session_id) out.sessionId = rec.session_id;
    if (typeof rec.result === "string") {
      if (rec.type === "result" || out.text === null) out.text = rec.result;
    }
    if (rec.is_error === true) out.isError = true;
  };
  for (const node of parsed) visit(node);

  if (out.text === null && parsed.length === 0 && trimmed) out.text = trimmed;
  return out;
}

function excerpt(text: string, max: number): string {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

/** Turno headless completo; busy SIEMPRE se limpia en finally. */
async function runTurn(text: string, turnId: string): Promise<void> {
  try {
    const [config, session] = await Promise.all([readConfig(), readSession()]);

    const args = ["-p", "--output-format", "json"];
    if (session.sessionId) args.push("--resume", session.sessionId);
    // Elevación EXCLUSIVAMENTE vía config.json accionado por el director humano.
    if (config.permissionMode === "acceptEdits") {
      args.push("--permission-mode", "acceptEdits");
    }
    args.push(text);

    const result = await execClaude(args);

    if (result.timedOut) {
      await appendMessage({
        ts: nowIso(),
        role: "system",
        text: "El turno del orquestador superó el límite de 15 minutos y fue cancelado.",
        turnId
      });
      return;
    }

    const output = parseClaudeOutput(result.stdout);

    if (output.sessionId) {
      await writeSession({ sessionId: output.sessionId });
    }

    if (result.code !== 0 || output.isError) {
      const detail = excerpt(
        output.text || result.stderr || result.stdout,
        STDERR_EXCERPT
      );
      await appendMessage({
        ts: nowIso(),
        role: "system",
        text: `La sesión del orquestador terminó con error (exit ${result.code ?? "?"})${detail ? `: ${detail}` : "."}`,
        turnId
      });
      return;
    }

    if (output.text) {
      // Si el turno fue denegado por permisos, el texto lo dice y se muestra
      // igual: es información honesta para el director.
      await appendMessage({ ts: nowIso(), role: "studio", text: output.text, turnId });
    } else {
      await appendMessage({
        ts: nowIso(),
        role: "system",
        text: "El orquestador terminó el turno sin texto de respuesta.",
        turnId
      });
    }
  } catch (err) {
    const isEnoent =
      err instanceof Error && (err as NodeJS.ErrnoException).code === "ENOENT";
    const detail = isEnoent
      ? "el binario `claude` no está en el PATH del servidor (ENOENT)."
      : `${excerpt(err instanceof Error ? err.message : String(err), STDERR_EXCERPT)}`;
    try {
      await appendMessage({
        ts: nowIso(),
        role: "system",
        text: `No se pudo completar el turno del orquestador: ${detail}`,
        turnId
      });
    } catch {
      // si ni el thread se puede escribir, no hay nada más que hacer
    }
  } finally {
    try {
      await writeSession({ busy: false });
    } catch {
      // best-effort: nunca propagar desde finally
    }
  }
}

export async function POST(request: Request) {
  let text = "";
  try {
    const body = (await request.json()) as unknown;
    if (body && typeof body === "object" && !Array.isArray(body)) {
      const raw = (body as Record<string, unknown>).text;
      if (typeof raw === "string") text = raw.trim();
    }
  } catch {
    return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  }

  if (!text) {
    return NextResponse.json({ error: "empty-text" }, { status: 400 });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: "text-too-long" }, { status: 400 });
  }

  const turnId = await withPostLock(async (): Promise<string | null> => {
    const session = await readSession();
    if (isBusy(session)) return null;
    const id = randomUUID();
    await appendMessage({ ts: nowIso(), role: "director", text, turnId: id });
    await writeSession({ busy: true });
    return id;
  });

  if (turnId === null) {
    return NextResponse.json({ error: "busy" }, { status: 409 });
  }

  // Proceso async: la respuesta no espera el turno del orquestador.
  void runTurn(text, turnId);

  return NextResponse.json({ ok: true, turnId }, { status: 202 });
}

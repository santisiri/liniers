import { promises as fs } from "fs";
import path from "path";
import { execFile } from "child_process";
import { NextResponse } from "next/server";
import { liniersRoot } from "@/lib/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Configuración de claves de API por nivel de generación.
 *
 * GET    → por nivel: purpose, provider, model, status y presencia enmascarada
 *          de la clave ({ set, last4 }). El valor completo JAMÁS viaja al cliente.
 * POST   → { tier, apiKey?, provider?, model? } escribe/mergea el .env de la raíz
 *          del repo (creado con modo 600 si falta, preservando líneas ajenas) y
 *          actualiza pipeline/providers.json (status → "configured" si hay clave).
 *          { tier, clear: true } equivale a DELETE.
 * DELETE → ?tier=<id> (o body { tier }) remueve la clave del .env y revierte el
 *          status del nivel a su default.
 *
 * Los valores de las claves nunca se loguean ni aparecen en errores.
 */

const TIER_IDS = ["imageHero", "videoDraft", "videoFinal"] as const;
type TierId = (typeof TIER_IDS)[number];

const TIER_DEFAULTS: Record<
  TierId,
  { provider: string | null; model: string | null; status: string }
> = {
  imageHero: { provider: "mcp", model: null, status: "mcp-default" },
  videoDraft: { provider: "mcp", model: null, status: "mcp-default" },
  videoFinal: { provider: null, model: null, status: "pending-director" }
};

const DEFAULT_ENV_KEYS: Record<TierId, string> = {
  imageHero: "IMAGE_HERO_API_KEY",
  videoDraft: "VIDEO_DRAFT_API_KEY",
  videoFinal: "VIDEO_FINAL_API_KEY"
};

/** API keys: ASCII imprimible sin espacios; sin comillas, #, ni backslash. */
const KEY_RE = /^[\x21-\x7e]{4,512}$/;
const KEY_FORBIDDEN = /["'#\\]/;
/** provider / model: slug razonable (fal, replicate, flux-pro/v1.1, veo-3…). */
const FIELD_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/;

interface ProvidersTier {
  purpose?: string;
  provider?: string | null;
  model?: string | null;
  envKey?: string;
  status?: string;
  [key: string]: unknown;
}

interface ProvidersJson {
  tiers?: Record<string, ProvidersTier>;
  [key: string]: unknown;
}

function envPath(): string {
  return path.join(liniersRoot(), ".env");
}

function providersPath(): string {
  return path.join(liniersRoot(), "pipeline", "providers.json");
}

// ---------------------------------------------------------------- .env helpers

const ENV_LINE_RE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;

const ENV_HEADER = [
  "# Claves de generación por nivel — creado desde el dashboard (Sala de Control).",
  "# Archivo gitignoreado; ver .env.example para la documentación de los slots.",
  ""
];

/** Lee el .env como líneas crudas; null si el archivo no existe. */
async function readEnvLines(): Promise<string[] | null> {
  try {
    const raw = await fs.readFile(envPath(), "utf8");
    return raw.split(/\r?\n/);
  } catch {
    return null;
  }
}

/** Escribe el .env preservando las líneas dadas; modo 600 al crearlo. */
async function writeEnvLines(lines: string[]): Promise<void> {
  const trimmed = [...lines];
  while (trimmed.length > 0 && trimmed[trimmed.length - 1].trim() === "") {
    trimmed.pop();
  }
  const content = trimmed.join("\n") + "\n";
  await fs.writeFile(envPath(), content, { encoding: "utf8", mode: 0o600 });
}

/** Valor de una variable en las líneas del .env ("" si falta o está vacía). */
function envValueFrom(lines: string[], key: string): string {
  for (const line of lines) {
    const m = ENV_LINE_RE.exec(line);
    if (!m || m[1] !== key) continue;
    let v = m[2].replace(/\s+#.*$/, "").trim();
    if (v.startsWith("#")) return "";
    const q = v[0];
    if ((q === '"' || q === "'") && v.length >= 2 && v.endsWith(q)) {
      v = v.slice(1, -1);
    }
    return v;
  }
  return "";
}

/** Reemplaza (o apendea) la línea KEY=value preservando todas las demás. */
function setEnvLine(lines: string[], key: string, value: string): void {
  const next = `${key}=${value}`;
  const idx = lines.findIndex((line) => {
    const m = ENV_LINE_RE.exec(line);
    return m !== null && m[1] === key;
  });
  if (idx >= 0) lines[idx] = next;
  else lines.push(next);
}

/** Remueve la línea de una variable, dejando el resto intacto. */
function removeEnvLine(lines: string[], key: string): string[] {
  return lines.filter((line) => {
    const m = ENV_LINE_RE.exec(line);
    return !(m && m[1] === key);
  });
}

// ------------------------------------------------------- providers.json helpers

async function readProviders(): Promise<ProvidersJson | null> {
  try {
    const parsed = JSON.parse(await fs.readFile(providersPath(), "utf8")) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as ProvidersJson;
    }
    return null;
  } catch {
    return null;
  }
}

async function writeProviders(data: ProvidersJson): Promise<void> {
  await fs.writeFile(providersPath(), JSON.stringify(data, null, 2) + "\n", "utf8");
}

function tierEnvKey(tier: ProvidersTier, id: TierId): string {
  return typeof tier.envKey === "string" && tier.envKey
    ? tier.envKey
    : DEFAULT_ENV_KEYS[id];
}

/** Shape público de un nivel: la clave solo como presencia enmascarada. */
function tierPayload(
  id: TierId,
  providers: ProvidersJson | null,
  envLines: string[] | null
) {
  const tier: ProvidersTier = providers?.tiers?.[id] ?? {};
  const envKey = tierEnvKey(tier, id);
  const value = envLines ? envValueFrom(envLines, envKey) : "";
  return {
    id,
    purpose: typeof tier.purpose === "string" ? tier.purpose : "",
    provider: tier.provider === undefined ? TIER_DEFAULTS[id].provider : tier.provider,
    model: tier.model === undefined ? TIER_DEFAULTS[id].model : tier.model,
    status: typeof tier.status === "string" ? tier.status : TIER_DEFAULTS[id].status,
    envKey,
    key: value
      ? { set: true, last4: value.length >= 8 ? value.slice(-4) : null }
      : { set: false }
  };
}

// ---------------------------------------------------------------------- misc

function errorResponse(code: string, status: number) {
  return NextResponse.json({ error: code }, { status });
}

function strField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Log de actividad vía scripts/log.mjs — nunca incluye valores de claves. */
function logStudio(summary: string, refs: string[]): void {
  const script = path.join(liniersRoot(), "scripts", "log.mjs");
  execFile(process.execPath, [script, "studio", "status", summary, ...refs], () => {
    /* best-effort: el request nunca falla ni se bloquea por el log */
  });
}

// ------------------------------------------------------------------- handlers

export async function GET() {
  const providers = await readProviders();
  const envLines = await readEnvLines();
  return NextResponse.json({
    tiers: TIER_IDS.map((id) => tierPayload(id, providers, envLines))
  });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    const parsed = (await request.json()) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return errorResponse("invalid-body", 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return errorResponse("invalid-body", 400);
  }

  const tier = body.tier;
  if (typeof tier !== "string" || !(TIER_IDS as readonly string[]).includes(tier)) {
    return errorResponse("invalid-tier", 400);
  }
  const tierId = tier as TierId;

  if (body.clear === true) return clearTier(tierId);

  const apiKey = strField(body.apiKey);
  const provider = strField(body.provider);
  const model = strField(body.model);

  if (!apiKey && !provider && !model) return errorResponse("nothing-to-save", 400);
  if (apiKey && (!KEY_RE.test(apiKey) || KEY_FORBIDDEN.test(apiKey))) {
    return errorResponse("invalid-key", 400);
  }
  if (provider && !FIELD_RE.test(provider)) return errorResponse("invalid-provider", 400);
  if (model && !FIELD_RE.test(model)) return errorResponse("invalid-model", 400);

  const providers = await readProviders();
  if (!providers) return errorResponse("providers-unreadable", 500);
  const tiers = (providers.tiers = providers.tiers ?? {});
  const tierData = (tiers[tierId] = tiers[tierId] ?? {});
  const envKey = tierEnvKey(tierData, tierId);
  const base = envKey.replace(/_API_KEY$/, "");

  const existing = await readEnvLines();
  const lines = existing ?? [...ENV_HEADER];
  if (apiKey) setEnvLine(lines, envKey, apiKey);
  if (provider) {
    setEnvLine(lines, `${base}_PROVIDER`, provider);
    tierData.provider = provider;
  }
  if (model) {
    setEnvLine(lines, `${base}_MODEL`, model);
    tierData.model = model;
  }
  if (envValueFrom(lines, envKey) !== "") {
    tierData.status = "configured";
  }

  try {
    await writeEnvLines(lines);
    await writeProviders(providers);
  } catch {
    return errorResponse("write-failed", 500);
  }

  const changed: string[] = [];
  if (apiKey) changed.push("clave");
  if (provider) changed.push("proveedor");
  if (model) changed.push("modelo");
  logStudio(
    `Configuración del nivel ${tierId} actualizada desde el dashboard (${changed.join(", ")}); status: ${tierData.status ?? "?"}`,
    ["pipeline/providers.json"]
  );

  return NextResponse.json({ ok: true, tier: tierPayload(tierId, providers, lines) });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  let tier: unknown = url.searchParams.get("tier");
  if (!tier) {
    try {
      const body = (await request.json()) as { tier?: unknown } | null;
      tier = body?.tier;
    } catch {
      /* sin body: queda el query param */
    }
  }
  if (typeof tier !== "string" || !(TIER_IDS as readonly string[]).includes(tier)) {
    return errorResponse("invalid-tier", 400);
  }
  return clearTier(tier as TierId);
}

/** Remueve la clave del .env y revierte el nivel a su backend por defecto. */
async function clearTier(tierId: TierId) {
  const providers = await readProviders();
  if (!providers) return errorResponse("providers-unreadable", 500);
  const tiers = (providers.tiers = providers.tiers ?? {});
  const tierData = (tiers[tierId] = tiers[tierId] ?? {});
  const envKey = tierEnvKey(tierData, tierId);
  const base = envKey.replace(/_API_KEY$/, "");

  let lines = await readEnvLines();
  if (lines) {
    lines = removeEnvLine(lines, envKey);
    lines = removeEnvLine(lines, `${base}_PROVIDER`);
    lines = removeEnvLine(lines, `${base}_MODEL`);
  }

  const defaults = TIER_DEFAULTS[tierId];
  tierData.provider = defaults.provider;
  tierData.model = defaults.model;
  tierData.status = defaults.status;

  try {
    if (lines) await writeEnvLines(lines);
    await writeProviders(providers);
  } catch {
    return errorResponse("write-failed", 500);
  }

  logStudio(
    `Clave del nivel ${tierId} eliminada desde el dashboard; status revertido a ${defaults.status}`,
    ["pipeline/providers.json"]
  );

  return NextResponse.json({ ok: true, tier: tierPayload(tierId, providers, lines) });
}

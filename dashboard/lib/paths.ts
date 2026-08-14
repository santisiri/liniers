import path from "path";

/** Root of the Liniers repo (data source for every API route). */
export function liniersRoot(): string {
  return process.env.LINIERS_ROOT || path.resolve(process.cwd(), "..");
}

export function artRoot(): string {
  return path.join(liniersRoot(), "art");
}

export function stateFile(): string {
  return path.join(liniersRoot(), "pipeline", "state.json");
}

export function logFile(): string {
  return path.join(liniersRoot(), "pipeline", "log", "conversations.jsonl");
}

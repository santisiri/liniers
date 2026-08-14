#!/usr/bin/env node
/**
 * log.mjs — apéndice al log de conversaciones del estudio
 * (pipeline/log/conversations.jsonl), una entrada JSONL por evento.
 *
 * Node >= 18, ESM, cero dependencias.
 *
 * CLI:
 *   node scripts/log.mjs <agent> <type> "<summary>" [refs...]
 *
 * type ∈ status | question | decision | artifact | handoff | verdict
 *
 * Módulo:
 *   import { appendLog, LOG_TYPES } from './log.mjs';
 *   appendLog('episode-writer', 'artifact', 'Guion ep01 listo', ['story/episodes/ep01/script.es.md']);
 *
 * Formato (CLAUDE.md):
 *   {"ts":"<ISO-8601 UTC>","agent":"<slug>","type":"...","summary":"<una frase>","refs":["<paths>"]}
 *
 * `LINIERS_LOG_PATH` (env) permite apuntar a otro .jsonl (tests).
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const LOG_PATH =
  process.env.LINIERS_LOG_PATH ||
  fileURLToPath(new URL('../pipeline/log/conversations.jsonl', import.meta.url));

export const LOG_TYPES = ['status', 'question', 'decision', 'artifact', 'handoff', 'verdict'];

/** ISO-8601 UTC sin milisegundos, ej. 2026-08-14T20:18:37Z */
export function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Valida y apendea una entrada al JSONL. Devuelve la entrada escrita.
 */
export function appendLog(agent, type, summary, refs = []) {
  if (!agent || typeof agent !== 'string') {
    throw new Error('agent requerido (slug del agente, ej. "episode-writer")');
  }
  if (!LOG_TYPES.includes(type)) {
    throw new Error(`type inválido "${type}" — válidos: ${LOG_TYPES.join(' | ')}`);
  }
  if (!summary || typeof summary !== 'string') {
    throw new Error('summary requerido (una frase)');
  }
  const entry = {
    ts: nowIso(),
    agent,
    type,
    summary,
    refs: Array.isArray(refs) ? refs.map(String) : [String(refs)],
  };
  mkdirSync(dirname(LOG_PATH), { recursive: true });
  appendFileSync(LOG_PATH, JSON.stringify(entry) + '\n', 'utf8');
  return entry;
}

// ---------------------------------------------------------------- CLI

const USAGE = `log.mjs — log de conversaciones del estudio (pipeline/log/conversations.jsonl)

Uso:
  node scripts/log.mjs <agent> <type> "<summary>" [refs...]

  agent    slug del agente (ej. studio, episode-writer, continuity-guardian)
  type     ${LOG_TYPES.join(' | ')}
  summary  una frase (entre comillas)
  refs     cero o más paths relativos al repo

Ejemplos:
  node scripts/log.mjs studio status "scripts del pipeline operativos" scripts/README.md
  node scripts/log.mjs continuity-guardian verdict "ep01 PASS r2" story/continuity/ep01-r2.md
`;

function isMain() {
  if (!process.argv[1]) return false;
  try {
    return resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isMain()) {
  const args = process.argv.slice(2);
  if (args[0] === '--help' || args[0] === '-h' || args[0] === 'help') {
    process.stdout.write(USAGE);
  } else if (args.length < 3) {
    process.stderr.write(USAGE);
    process.exitCode = 1;
  } else {
    try {
      const [agent, type, summary, ...refs] = args;
      const entry = appendLog(agent, type, summary, refs);
      console.log(`ok: ${entry.ts} ${entry.agent} ${entry.type}`);
    } catch (err) {
      process.stderr.write(`error: ${err.message}\n`);
      process.exitCode = 1;
    }
  }
}

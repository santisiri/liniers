#!/usr/bin/env node
/**
 * state.mjs — CLI y módulo importable sobre pipeline/state.json,
 * la única fuente de verdad del progreso del proyecto.
 *
 * Node >= 18, ESM, cero dependencias.
 *
 * CLI:
 *   node scripts/state.mjs get <dot.path>
 *   node scripts/state.mjs set <dot.path> <valor>
 *   node scripts/state.mjs phase <fase>
 *   node scripts/state.mjs episode <epNN> <status>
 *   node scripts/state.mjs decision <dec-NNN> <respuesta>
 *
 * Módulo:
 *   import { readState, writeState, get, set, setPhase,
 *            setEpisodeStatus, resolveDecision } from './state.mjs';
 *
 * Toda escritura actualiza `updatedAt` (ISO UTC) y es atómica (tmp + rename).
 * `LINIERS_STATE_PATH` (env) permite apuntar a otro state.json (tests).
 */

import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const STATE_PATH =
  process.env.LINIERS_STATE_PATH ||
  fileURLToPath(new URL('../pipeline/state.json', import.meta.url));

export const PHASES = ['setup', 'ingest', 'bible', 'characters', 'episodes', 'post'];

export const EPISODE_STATUSES = [
  'outline',
  'draft',
  'continuity_review',
  'approved',
  'storyboard',
  'prompts',
  'rendering',
  'done',
];

/** ISO-8601 UTC sin milisegundos, ej. 2026-08-14T20:18:37Z */
export function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Lee y parsea pipeline/state.json. */
export function readState() {
  return JSON.parse(readFileSync(STATE_PATH, 'utf8'));
}

/**
 * Escribe el estado de forma atómica (archivo temporal + rename)
 * actualizando siempre `updatedAt`.
 */
export function writeState(state) {
  state.updatedAt = nowIso();
  const tmp = `${STATE_PATH}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n', 'utf8');
  renameSync(tmp, STATE_PATH);
  return state;
}

/** Intenta parsear JSON; si falla, devuelve el string tal cual. */
export function coerce(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function segmentsOf(dotPath) {
  if (typeof dotPath !== 'string' || dotPath.length === 0) {
    throw new Error('dot.path vacío');
  }
  return dotPath.split('.');
}

/** Navega un objeto por dot.path (índices numéricos entran en arrays). */
export function getPath(obj, dotPath) {
  let cur = obj;
  for (const seg of segmentsOf(dotPath)) {
    if (cur == null) return undefined;
    const key = Array.isArray(cur) && /^\d+$/.test(seg) ? Number(seg) : seg;
    cur = cur[key];
  }
  return cur;
}

/** Asigna un valor por dot.path creando objetos intermedios si faltan. */
export function setPath(obj, dotPath, value) {
  const segs = segmentsOf(dotPath);
  let cur = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i];
    const key = Array.isArray(cur) && /^\d+$/.test(seg) ? Number(seg) : seg;
    if (cur[key] == null || typeof cur[key] !== 'object') {
      cur[key] = /^\d+$/.test(segs[i + 1]) ? [] : {};
    }
    cur = cur[key];
  }
  const last = segs[segs.length - 1];
  const lastKey = Array.isArray(cur) && /^\d+$/.test(last) ? Number(last) : last;
  cur[lastKey] = value;
  return obj;
}

/** get sobre el state actual. */
export function get(dotPath) {
  return getPath(readState(), dotPath);
}

/** set sobre el state actual (escritura atómica, updatedAt). */
export function set(dotPath, value) {
  const state = readState();
  setPath(state, dotPath, value);
  return writeState(state);
}

/** Cambia project.phase validando contra PHASES. */
export function setPhase(phase) {
  if (!PHASES.includes(phase)) {
    throw new Error(`fase inválida "${phase}" — válidas: ${PHASES.join(' ')}`);
  }
  return set('project.phase', phase);
}

function defaultTitle(id, languages) {
  const n = String(Number.parseInt(id.slice(2), 10));
  const title = {};
  for (const lang of languages && languages.length ? languages : ['es', 'en']) {
    title[lang] = lang === 'es' ? `Episodio ${n}` : `Episode ${n}`;
  }
  return title;
}

/**
 * Cambia el status de un episodio; lo crea (con título por defecto en los
 * idiomas del proyecto) si no existe. Valida id `epNN` y los 8 estados.
 */
export function setEpisodeStatus(id, status) {
  if (!/^ep\d{2}$/.test(id)) {
    throw new Error(`id de episodio inválido "${id}" — formato: ep01, ep02, …`);
  }
  if (!EPISODE_STATUSES.includes(status)) {
    throw new Error(
      `status de episodio inválido "${status}" — válidos: ${EPISODE_STATUSES.join(' ')}`
    );
  }
  const state = readState();
  if (!Array.isArray(state.episodes)) state.episodes = [];
  let ep = state.episodes.find((e) => e.id === id);
  if (!ep) {
    ep = {
      id,
      title: defaultTitle(id, state.project?.languages),
      status,
      files: {},
      continuityReports: [],
    };
    state.episodes.push(ep);
    state.episodes.sort((a, b) => a.id.localeCompare(b.id));
  } else {
    ep.status = status;
  }
  writeState(state);
  return ep;
}

/**
 * Resuelve una decisión pendiente: la mueve de decisions.pending a
 * decisions.resolved con status "answered", answer y answeredAt.
 */
export function resolveDecision(id, answer) {
  if (!/^dec-\d{3}$/.test(id)) {
    throw new Error(`id de decisión inválido "${id}" — formato: dec-001, dec-002, …`);
  }
  const state = readState();
  const pending = state.decisions?.pending ?? [];
  const idx = pending.findIndex((d) => d.id === id);
  if (idx === -1) {
    const done = (state.decisions?.resolved ?? []).some((d) => d.id === id);
    throw new Error(
      done
        ? `la decisión ${id} ya está resuelta`
        : `decisión ${id} no encontrada en decisions.pending`
    );
  }
  const dec = pending.splice(idx, 1)[0];
  if (Array.isArray(dec.options) && dec.options.length && !dec.options.includes(answer)) {
    process.stderr.write(
      `aviso: la respuesta "${answer}" no está entre las opciones sugeridas (${dec.options.join(', ')})\n`
    );
  }
  dec.status = 'answered';
  dec.answer = answer;
  dec.answeredAt = nowIso();
  if (!Array.isArray(state.decisions.resolved)) state.decisions.resolved = [];
  state.decisions.resolved.push(dec);
  writeState(state);
  return dec;
}

// ---------------------------------------------------------------- CLI

const USAGE = `state.mjs — estado del pipeline (pipeline/state.json)

Uso:
  node scripts/state.mjs get <dot.path>              imprime el valor como JSON
  node scripts/state.mjs set <dot.path> <valor>      valor: JSON si parsea, si no string
  node scripts/state.mjs phase <fase>                ${PHASES.join(' | ')}
  node scripts/state.mjs episode <epNN> <status>     ${EPISODE_STATUSES.join(' | ')}
                                                     (crea el episodio si no existe)
  node scripts/state.mjs decision <dec-NNN> <resp>   mueve la decisión de pending a
                                                     resolved (answered + answeredAt)

Ejemplos:
  node scripts/state.mjs get project.phase
  node scripts/state.mjs set source.youtubeUrl '"https://youtu.be/XXXX"'
  node scripts/state.mjs phase ingest
  node scripts/state.mjs episode ep01 draft
  node scripts/state.mjs decision dec-001 ilustracion-acuarela

Toda escritura actualiza updatedAt (ISO UTC) y es atómica (tmp + rename).
`;

function isMain() {
  if (!process.argv[1]) return false;
  try {
    return resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

function cli(argv) {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case 'get': {
      if (rest.length !== 1) throw new Error('uso: get <dot.path>');
      const value = get(rest[0]);
      if (value === undefined) {
        throw new Error(`ruta "${rest[0]}" no encontrada en state.json`);
      }
      console.log(JSON.stringify(value, null, 2));
      return;
    }
    case 'set': {
      if (rest.length < 2) throw new Error('uso: set <dot.path> <valor>');
      const value = coerce(rest.slice(1).join(' '));
      set(rest[0], value);
      console.log(`ok: ${rest[0]} = ${JSON.stringify(value)}`);
      return;
    }
    case 'phase': {
      if (rest.length !== 1) throw new Error('uso: phase <fase>');
      setPhase(rest[0]);
      console.log(`ok: project.phase = ${JSON.stringify(rest[0])}`);
      return;
    }
    case 'episode': {
      if (rest.length !== 2) throw new Error('uso: episode <epNN> <status>');
      const ep = setEpisodeStatus(rest[0], rest[1]);
      console.log(`ok: ${ep.id}.status = ${JSON.stringify(ep.status)}`);
      return;
    }
    case 'decision': {
      if (rest.length < 2) throw new Error('uso: decision <dec-NNN> <respuesta>');
      const dec = resolveDecision(rest[0], rest.slice(1).join(' '));
      console.log(`ok: ${dec.id} → answered (${JSON.stringify(dec.answer)})`);
      return;
    }
    case '--help':
    case '-h':
    case 'help':
      process.stdout.write(USAGE);
      return;
    default:
      process.stderr.write(USAGE);
      process.exitCode = 1;
  }
}

if (isMain()) {
  try {
    cli(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`error: ${err.message}\n`);
    process.exitCode = 1;
  }
}

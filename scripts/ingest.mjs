#!/usr/bin/env node
/**
 * ingest.mjs — ingesta del video fuente: descarga bestaudio (m4a) con yt-dlp
 * y transcribe con whisper (txt + srt + json con timestamps).
 *
 * Node >= 18, ESM, cero dependencias (usa yt-dlp, whisper y ffmpeg del PATH).
 *
 * Uso:
 *   node scripts/ingest.mjs --url <youtube-url> [--lang es] [--model medium]
 *
 * Salidas:
 *   source/media/raw.m4a
 *   source/transcript/<lang>/raw.{txt,srt,json,vtt,tsv}
 *   source/video.json            (youtubeUrl, title, durationSeconds)
 *   pipeline/state.json          (source.*, phase → ingest si estaba en setup)
 */

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as state from './state.mjs';
import { appendLog } from './log.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MEDIA_DIR = join(ROOT, 'source', 'media');
const AUDIO_BASENAME = 'raw';
const AUDIO_FILE = join(MEDIA_DIR, `${AUDIO_BASENAME}.m4a`);
const VIDEO_JSON = join(ROOT, 'source', 'video.json');

const USAGE = `ingest.mjs — descarga y transcribe el video fuente de YouTube

Uso:
  node scripts/ingest.mjs --url <youtube-url> [--lang es] [--model medium]

Opciones:
  --url <url>      URL del video de YouTube (requerido)
  --lang <code>    idioma de la transcripción (default: es)
  --model <name>   modelo de whisper: tiny | base | small | medium | large
                   (default: medium)
  --help, -h       muestra esta ayuda

Requisitos (macOS):
  brew install yt-dlp          # descarga de audio
  brew install ffmpeg          # decodificación (lo usan yt-dlp y whisper)
  pipx install openai-whisper  # transcripción (o: pip install -U openai-whisper)

  Alternativa rápida en Apple Silicon: mlx-whisper (pipx install mlx-whisper).
  Este script invoca \`whisper\`; si preferís mlx-whisper, corrélo a mano sobre
  source/media/raw.m4a y guardá raw.{txt,srt,json} en source/transcript/<lang>/.

Qué hace:
  1. Verifica yt-dlp, whisper y ffmpeg en el PATH (sale con 1 si falta alguno).
  2. Descarga bestaudio como m4a → source/media/raw.m4a
  3. Transcribe con timestamps → source/transcript/<lang>/raw.{txt,srt,json}
  4. Actualiza source/video.json (url, título, duración) y pipeline/state.json
     (source.youtubeUrl, source.media, source.transcripts.<lang>; project.phase
     pasa a "ingest" solo si estaba en "setup").
  5. Registra la ingesta en pipeline/log/conversations.jsonl.

Ejemplo:
  node scripts/ingest.mjs --url https://www.youtube.com/watch?v=XXXXXXXX --lang es --model medium
`;

function parseArgs(argv) {
  const opts = { url: null, lang: 'es', model: 'medium', help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--url') opts.url = argv[++i];
    else if (a === '--lang') opts.lang = argv[++i];
    else if (a === '--model') opts.model = argv[++i];
    else throw new Error(`opción desconocida: ${a} (ver --help)`);
  }
  return opts;
}

function which(cmd) {
  const r = spawnSync('/bin/sh', ['-c', `command -v ${cmd}`], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

function checkTools() {
  const missing = [];
  if (!which('yt-dlp')) missing.push('  yt-dlp   → brew install yt-dlp');
  if (!which('ffmpeg')) missing.push('  ffmpeg   → brew install ffmpeg   (lo requieren yt-dlp y whisper)');
  if (!which('whisper')) {
    missing.push(
      '  whisper  → pipx install openai-whisper   (o: pip install -U openai-whisper)\n' +
        '             Alternativa rápida en Apple Silicon: pipx install mlx-whisper\n' +
        '             (mlx-whisper se corre a mano; este script invoca `whisper`).'
    );
  }
  if (missing.length) {
    process.stderr.write(
      'Faltan herramientas en el PATH. Instalación en macOS:\n\n' +
        missing.join('\n') +
        '\n\nNo se modificó ningún archivo. Instalá lo que falte y reintentá.\n'
    );
    return false;
  }
  return true;
}

function run(cmd, args, opts = {}) {
  process.stderr.write(`\n$ ${cmd} ${args.join(' ')}\n`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.error) throw new Error(`${cmd}: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`${cmd} salió con código ${r.status}`);
}

function fetchMetadata(url) {
  const r = spawnSync(
    'yt-dlp',
    ['--no-playlist', '--skip-download', '--print', 'title', '--print', 'duration', '--', url],
    { encoding: 'utf8' }
  );
  if (r.status !== 0) {
    process.stderr.write(r.stderr || '');
    throw new Error('yt-dlp no pudo leer los metadatos del video (¿URL válida?)');
  }
  const [title, duration] = r.stdout.trim().split('\n');
  const seconds = Number.parseInt(duration, 10);
  return { title: title || null, durationSeconds: Number.isFinite(seconds) ? seconds : null };
}

function downloadAudio(url) {
  mkdirSync(MEDIA_DIR, { recursive: true });
  run('yt-dlp', [
    '--no-playlist',
    '-f',
    'bestaudio[ext=m4a]/bestaudio',
    '-x',
    '--audio-format',
    'm4a',
    '-o',
    join(MEDIA_DIR, `${AUDIO_BASENAME}.%(ext)s`),
    '--',
    url,
  ]);
  if (!existsSync(AUDIO_FILE)) {
    throw new Error(`no se encontró ${AUDIO_FILE} después de la descarga`);
  }
  return AUDIO_FILE;
}

function transcribe(audioFile, lang, model) {
  const outDir = join(ROOT, 'source', 'transcript', lang);
  mkdirSync(outDir, { recursive: true });
  run('whisper', [
    audioFile,
    '--model',
    model,
    '--language',
    lang,
    '--task',
    'transcribe',
    '--output_dir',
    outDir,
    '--output_format',
    'all',
  ]);
  // Normalizar nombres a raw.<ext> (whisper nombra según el basename del audio,
  // que ya es "raw"; esto cubre cualquier variante).
  for (const f of readdirSync(outDir)) {
    const m = f.match(/^(.+)\.(txt|srt|json|vtt|tsv)$/);
    if (m && m[1] !== 'raw') renameSync(join(outDir, f), join(outDir, `raw.${m[2]}`));
  }
  for (const ext of ['txt', 'srt', 'json']) {
    if (!existsSync(join(outDir, `raw.${ext}`))) {
      throw new Error(`falta la salida esperada raw.${ext} en ${outDir}`);
    }
  }
  return outDir;
}

function updateVideoJson(url, meta) {
  let video = {};
  try {
    video = JSON.parse(readFileSync(VIDEO_JSON, 'utf8'));
  } catch {
    video = {};
  }
  video.youtubeUrl = url;
  if (meta.title != null) video.title = meta.title;
  if (meta.durationSeconds != null) video.durationSeconds = meta.durationSeconds;
  delete video.notes;
  const tmp = `${VIDEO_JSON}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(video, null, 2) + '\n', 'utf8');
  renameSync(tmp, VIDEO_JSON);
}

function updateState(url, lang) {
  const s = state.readState();
  s.source.youtubeUrl = url;
  s.source.media = 'source/media/raw.m4a';
  if (!s.source.transcripts || typeof s.source.transcripts !== 'object') {
    s.source.transcripts = {};
  }
  s.source.transcripts[lang] = `source/transcript/${lang}`;
  if (s.project.phase === 'setup') {
    s.project.phase = 'ingest';
  } else {
    process.stderr.write(
      `nota: project.phase ya está en "${s.project.phase}"; no se retrocede a ingest.\n`
    );
  }
  state.writeState(s);
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`error: ${err.message}\n`);
    process.exitCode = 1;
    return;
  }
  if (opts.help) {
    process.stdout.write(USAGE);
    return;
  }
  if (!opts.url) {
    process.stderr.write('error: falta --url <youtube-url>\n\n' + USAGE);
    process.exitCode = 1;
    return;
  }
  if (!checkTools()) {
    process.exitCode = 1;
    return;
  }
  try {
    const meta = fetchMetadata(opts.url);
    if (meta.title) process.stderr.write(`Video: ${meta.title} (${meta.durationSeconds ?? '?'}s)\n`);

    const audio = downloadAudio(opts.url);
    const outDir = transcribe(audio, opts.lang, opts.model);

    updateVideoJson(opts.url, meta);
    updateState(opts.url, opts.lang);
    appendLog(
      'ingest',
      'artifact',
      `Ingesta completa: audio m4a + transcripción ${opts.lang} (whisper ${opts.model}).`,
      ['source/media/raw.m4a', `source/transcript/${opts.lang}/raw.srt`, 'source/video.json']
    );

    process.stderr.write(
      `\nIngesta OK\n  audio:        source/media/raw.m4a\n` +
        `  transcripción: ${outDir.replace(ROOT, '')}/raw.{txt,srt,json}\n` +
        `  estado:       project.phase = ${state.get('project.phase')}\n`
    );
  } catch (err) {
    process.stderr.write(`error: ${err.message}\n`);
    process.exitCode = 1;
  }
}

const isMain = (() => {
  if (!process.argv[1]) return false;
  try {
    return resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();

if (isMain) main();

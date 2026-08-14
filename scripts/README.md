# scripts/ — herramientas del pipeline

Herramientas de línea de comandos del estudio. **Node >= 18, ESM (`.mjs`), cero
dependencias npm.** Todas se corren desde la raíz del repo (o desde cualquier
lado: resuelven sus rutas relativas al propio script).

| Script | Qué hace |
|---|---|
| `state.mjs` | Lee/escribe `pipeline/state.json` (la fuente de verdad del progreso) |
| `log.mjs` | Apendea eventos a `pipeline/log/conversations.jsonl` (memoria pública del estudio) |
| `ingest.mjs` | Descarga el audio del video fuente y lo transcribe con whisper |

## state.mjs

CLI y módulo importable sobre `pipeline/state.json`. Toda escritura actualiza
`updatedAt` (ISO UTC) y es atómica (archivo temporal + rename), así el dashboard
nunca lee un JSON a medio escribir.

```sh
node scripts/state.mjs get <dot.path>              # imprime el valor como JSON
node scripts/state.mjs set <dot.path> <valor>      # valor: JSON si parsea, si no string
node scripts/state.mjs phase <fase>                # setup|ingest|bible|characters|episodes|post
node scripts/state.mjs episode <epNN> <status>     # outline|draft|continuity_review|approved|
                                                   # storyboard|prompts|rendering|done
                                                   # crea el episodio si no existe
node scripts/state.mjs decision <dec-NNN> <resp>   # pending → resolved (answered + answeredAt)
```

Ejemplos:

```sh
node scripts/state.mjs get project.phase
node scripts/state.mjs get episodes.0.status
node scripts/state.mjs set source.segmentation '"story/bible/segmentation.json"'
node scripts/state.mjs phase bible
node scripts/state.mjs episode ep01 continuity_review
node scripts/state.mjs decision dec-001 ilustracion-acuarela
```

Como módulo:

```js
import { readState, writeState, get, set, setPhase,
         setEpisodeStatus, resolveDecision } from './scripts/state.mjs';

setEpisodeStatus('ep02', 'draft');
resolveDecision('dec-002', '6 episodios de ~8 min');
```

Env: `LINIERS_STATE_PATH` apunta a otro `state.json` (útil para tests).

## log.mjs

Apéndice JSONL a `pipeline/log/conversations.jsonl` con el formato de
`CLAUDE.md`. El `ts` se genera siempre en ISO-8601 UTC.

```sh
node scripts/log.mjs <agent> <type> "<summary>" [refs...]
# type: status | question | decision | artifact | handoff | verdict
```

Ejemplos:

```sh
node scripts/log.mjs studio status "scripts del pipeline operativos" scripts/README.md
node scripts/log.mjs continuity-guardian verdict "ep01 PASS r2" story/continuity/ep01-r2.md
node scripts/log.mjs episode-writer handoff "ep01 draft listo para continuidad" story/episodes/ep01/script.es.md
```

Como módulo:

```js
import { appendLog } from './scripts/log.mjs';
appendLog('prompt-smith', 'artifact', 'Prompts de ep01-sc01 refinados (r3)', ['art/storyboards/ep01/']);
```

Env: `LINIERS_LOG_PATH` apunta a otro `.jsonl` (útil para tests).

## ingest.mjs

Descarga el bestaudio del video fuente como m4a y lo transcribe con whisper
(timestamps incluidos). Actualiza `source/video.json` y `pipeline/state.json`
reutilizando `state.mjs` como módulo, y deja registro en el log.

```sh
node scripts/ingest.mjs --url <youtube-url> [--lang es] [--model medium]
node scripts/ingest.mjs --help
```

Salidas:

```
source/media/raw.m4a                          audio
source/transcript/<lang>/raw.txt              texto plano
source/transcript/<lang>/raw.srt              subtítulos con timestamps
source/transcript/<lang>/raw.json             segmentos + timestamps (whisper)
source/transcript/<lang>/raw.{vtt,tsv}        extras de whisper
```

En `state.json`: `source.youtubeUrl`, `source.media`,
`source.transcripts.<lang>` (directorio de la transcripción) y `project.phase`
pasa a `ingest` **solo si** estaba en `setup` (nunca retrocede una fase).

### Requisitos (macOS)

```sh
brew install yt-dlp          # descarga
brew install ffmpeg          # decodificación (lo usan yt-dlp y whisper)
pipx install openai-whisper  # transcripción (o: pip install -U openai-whisper)
```

Si falta alguna herramienta, el script imprime estas instrucciones y sale con
código 1 sin tocar ningún archivo.

**Apple Silicon**: `mlx-whisper` (`pipx install mlx-whisper`) transcribe mucho
más rápido usando la GPU. Este script invoca `whisper`; si preferís mlx-whisper,
corrélo a mano sobre `source/media/raw.m4a` y guardá `raw.{txt,srt,json}` en
`source/transcript/<lang>/`.

Modelos de whisper: `tiny` < `base` < `small` < `medium` < `large` (calidad y
tiempo crecen juntos; `medium` es buen balance para castellano rioplatense).

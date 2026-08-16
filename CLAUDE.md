# Liniers — Pipeline cinematográfico multiagente

Película episódica sobre las **Invasiones Inglesas de Buenos Aires (1806–1807)**. Este repo es un **estudio de cine operado por agentes**: cada rol del proceso (guion, continuidad, diseño de personajes, storyboard, prompts de generación, dirección, localización, render) es un agente con responsabilidades y protocolos definidos.

**Naturaleza de la obra (dec-003)**: es una **ficción dialogada** estilo producción de Hollywood — los personajes históricos (Liniers, Beresford, Sobremonte…) hablan en escena; no hay narrador en off ni presentadores en pantalla. La fuente (conversación Julia Rosemberg / Pedro Rosemblat, Gelatina — `source/transcript/es/clean.md`) es la **brújula historiográfica**: sus hechos, tesis y énfasis gobiernan qué historia se cuenta y desde dónde, pero los diálogos y escenas son dramaturgia propia. Estética: **live-action estilizado, 16:9** (dec-001/004). Tres episodios (dec-002).

**Idiomas**: el proyecto es multi-idioma desde el origen. Idioma de trabajo: `es`. Todo contenido narrativo tiene slot para `en` (y futuros idiomas). Claves de infraestructura (JSON, slugs, IDs) siempre en inglés; contenido en el idioma que corresponda.

## Mapa del repositorio

```
source/          Material fuente: URL del video, media descargada, transcripciones por idioma
story/           Biblia narrativa, fichas de personajes, guiones de episodios, reportes de continuidad
art/             Guía de estilo, diseños de personajes, storyboards, renders finales
pipeline/        Estado del proyecto (state.json), logs de conversaciones de agentes (JSONL), schemas
scripts/         Herramientas: ingesta/transcripción, helpers de estado y logging
dashboard/       App web (Next.js) para ver progreso, conversaciones entre agentes y galería de renders
vendor/          Clones de referencia (gitignored) — ej. anthropics/skills
.claude/agents/  Definiciones de los agentes del estudio
.claude/skills/  Loops del pipeline invocables como slash commands
```

## Máquina de estados

`pipeline/state.json` es la única fuente de verdad del progreso. Fases del proyecto:

`setup → ingest → bible → characters → episodes → post`

Cada episodio avanza por su propio ciclo:

`outline → draft → continuity_review → approved → storyboard → prompts → rendering → done`

**Regla de oro**: ningún episodio pasa de `continuity_review` a `approved` sin un reporte del agente `continuity-guardian` en `story/continuity/` con veredicto `PASS`. Ningún render se lanza sin storyboard aprobado.

Actualizar estado siempre vía `node scripts/state.mjs` (nunca editar `state.json` a mano si el script existe — mantiene `updatedAt` consistente).

## Protocolo de logging (conversaciones entre agentes)

Todo agente que trabaja en este repo **debe** registrar su actividad en `pipeline/log/conversations.jsonl`, una entrada por evento significativo:

```json
{"ts":"<ISO-8601 UTC>","agent":"<slug>","type":"status|question|decision|artifact|handoff|verdict","summary":"<una frase>","refs":["<paths>"],"to":"<slug opcional>"}
```

Usar `node scripts/log.mjs <agent> <type> "<summary>" [refs...] [--to <agente>]` cuando exista; si no, apéndice manual con `date -u +%Y-%m-%dT%H:%M:%SZ`. El campo `to` es opcional y declara el destinatario de un `handoff`/`question`; las entradas históricas no lo tienen y todo consumidor debe tolerar su ausencia. El dashboard lee este archivo en vivo: es la memoria pública del estudio. `handoff` marca traspaso de trabajo entre agentes; `question` marca una pregunta pendiente para el director humano.

## El estudio: agentes

**El orquestador (`studio`)**: la sesión principal de Claude Code sobre este repo ES el orquestador del estudio — el único rol que interfacea con el director humano (Santiago) y despacha a todos los demás. Recibe la intención del director (por terminal o por el chat del dashboard), la traduce en loops (`/episode`, `/characters`, `/shots`…), lanza los agentes, consolida sus resultados, actualiza el estado y reporta. Loguea como `agent: "studio"` y es el centro del mapa de agentes del dashboard. Los agentes especializados nunca dialogan directamente con el director: elevan `question` al log y el orquestador (o `creative-director` en sesión formal) las presenta.

El canal de chat del dashboard (vista Dirección) habla con el orquestador vía `POST /api/chat`: cada turno corre como sesión headless de Claude Code (`claude -p --output-format json`, `--resume` con el `sessionId` guardado) y el hilo persiste en `pipeline/chat/` (`thread.jsonl`, `session.json`, `config.json`). Modos de permiso: `default` (consulta — el spawn va sin ningún flag de permisos; lo que requiere aprobación se deniega) y `acceptEdits` (producción — puede editar archivos sin aprobación por cambio). El default es SIEMPRE `default`; solo el director humano eleva el modo desde el toggle de la vista, y ese config es el único camino de elevación.

| Agente | Rol |
|---|---|
| `transcript-analyst` | Analiza la transcripción fuente, segmenta en episodios/beats, glosario histórico |
| `episode-writer` | Escribe el guion de ficción de cada episodio (escenas, diálogo) guiado por las tesis de la fuente |
| `continuity-guardian` | Audita continuidad narrativa y visual episodio a episodio; emite PASS/FAIL |
| `character-designer` | Fichas y hojas de modelo de personajes; genera referencias visuales |
| `storyboard-artist` | Shot list y paneles de storyboard por escena |
| `prompt-smith` | Loop de refinamiento de prompts: generar → criticar contra guía de estilo → refinar |
| `creative-director` | Consolida decisiones pendientes de dirección/estética/cinematografía y consulta al director humano |
| `localizer` | Traducción y adaptación de todo contenido narrativo a los idiomas del proyecto |
| `render-producer` | Ejecuta y rastrea la cola de renders (imagen/video), organiza `art/renders/` |

## Loops del pipeline (skills)

| Comando | Loop |
|---|---|
| `/ingest <url>` | Descarga + transcribe el video fuente, segmenta episodios |
| `/episode <n>` | writer → continuity → revisión, hasta PASS |
| `/characters` | Diseño de personajes con referencias visuales aprobables |
| `/storyboard <n>` | Storyboard del episodio n contra guion aprobado |
| `/shots <n>` | Loop de prompts + generación de imagen/video por shot |
| `/director` | Junta preguntas `question` pendientes y las presenta al director humano |
| `/status` | Reconcilia estado, logs y archivos; refresca datos del dashboard |

## Generación de medios — tres niveles

Los agentes eligen por **nivel**, nunca por proveedor directo. El mapa nivel→proveedor vive en `pipeline/providers.json`:

| Nivel | Uso | Quién lo usa |
|---|---|---|
| `imageHero` | Imágenes definitivas: hojas de personaje, key frames, láminas de estilo | `character-designer`, `prompt-smith` |
| `videoDraft` | Video boceto barato: animatics, pruebas de movimiento, pre-vis | `render-producer` (pre-vis), `prompt-smith` (pruebas) |
| `videoFinal` | Render final de shots aprobados, máxima calidad | `render-producer`, solo con shot `approved` |

Backends:
1. **MCP conectado** (default de los tres niveles hoy): `generate_image`, `generate_video`, `generate_audio`, batch + `jobs_wait`, vía ToolSearch en cualquier sesión/subagente. Antes de crear hojas de personaje usar el workflow `character-sheet` del servidor (`get_workflow_instructions`). Ante duda de modelo: `models_explore(action:'recommend')`.
2. **APIs directas por nivel** (cuando el director entregue claves): `.env` según `.env.example`; un adaptador por proveedor en `scripts/providers/`, y se actualiza `pipeline/providers.json`. Nunca renderizar `videoFinal` en masa sin costo estimado logueado (`type: question` si supera lo acordado).
3. **Higgsfield MCP**: requiere autorización del usuario (pendiente).

Todo asset generado se guarda con metadata sidecar: `<archivo>.meta.json` → `{prompt, model, agent, ts, episode, scene, shot, seed?}`. Sin metadata no hay trazabilidad; sin trazabilidad no hay continuidad.

## Convenciones

- IDs: episodios `ep01`, escenas `ep01-sc03`, shots `ep01-sc03-sh02`, personajes slug en inglés (`liniers`, `beresford`).
- Guiones en `story/episodes/ep01/` : `outline.md`, `script.es.md`, `script.en.md`.
- Reportes de continuidad: `story/continuity/ep01-r<n>.md` con veredicto explícito en la primera línea.
- Decisiones de dirección viven en `pipeline/state.json → decisions`; nunca se decide estética sin consultar al director humano (Santiago).
- Commits en español, presente, prefijo de área: `story:`, `art:`, `pipeline:`, `dashboard:`.

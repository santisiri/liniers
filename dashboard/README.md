# Dashboard — Sala de Control

App Next.js 15 (App Router, TypeScript, CSS propio, sin dependencias de UI) que lee el estado del estudio directamente del repo.

## Correr

```bash
cd dashboard
npm install
npm run dev    # http://localhost:3000
npm run build && npm start
```

Raíz de datos: `LINIERS_ROOT` (default: el directorio padre de `dashboard/`).

## API

| Ruta | Fuente |
|---|---|
| `GET /api/state` | `pipeline/state.json` (shape vacío si falta) |
| `GET /api/log?limit=N` | últimas N líneas de `pipeline/log/conversations.jsonl` (tolerante a líneas corruptas) |
| `GET /api/gallery` | `art/{characters,storyboards,renders}` — imágenes/videos + sidecar `.meta.json`, agrupado por categoría/episodio |
| `GET /api/media/<path>` | sirve archivos de `art/` (extensiones permitidas, guard anti path-traversal, soporte de `Range`) |
| `GET /api/agents` | roster de `.claude/agents/*.md` (frontmatter) + roles de CLAUDE.md + stats del log por agente |
| `GET /api/graph` | grafo de interacciones derivado del log: aristas estructurales (pipeline), explícitas (`to`, menciones) y suaves (refs compartidos), con evidencia |
| `GET/POST/DELETE /api/settings` | claves de API por nivel (`imageHero`/`videoDraft`/`videoFinal`): mergea el `.env` de la raíz (modo 600) y `pipeline/providers.json`; la clave solo viaja como presencia enmascarada `{set,last4}` |
| `POST /api/chat` | `{text}` del director → appendea a `pipeline/chat/thread.jsonl`, marca busy y responde `202`; el turno corre async como `claude -p --output-format json` (primer turno sin `--resume`, siguientes con el `sessionId` de `pipeline/chat/session.json`), cwd = raíz del repo. Vacío → `400`; busy → `409`. Errores (ENOENT/exit≠0/timeout 15 min) → mensaje `system` al thread; busy siempre se limpia |
| `GET /api/chat/timeline?since=` | fusión cronológica de `pipeline/chat/thread.jsonl` + hitos de `conversations.jsonl` (types `artifact\|decision\|verdict\|question\|handoff`); refs imagen/video bajo `art/` viajan enriquecidos con `{url, model, status}` del sidecar `.meta.json`. Devuelve además `busy` y `permissionMode` |
| `GET/PATCH /api/chat/config` | modo de permisos del orquestador (`pipeline/chat/config.json`): `default` (consulta, seguro — el spawn va SIN flags de permisos) o `acceptEdits` (producción — agrega `--permission-mode acceptEdits`). Nace siempre en `default`; solo lo cambia el director desde el toggle de Dirección. El PATCH valida el enum y loguea la decisión al log del estudio |

## Vistas

- **Dirección** (default): chat del director con el orquestador (sesión headless de Claude Code sobre el repo) con los hitos de la película intercalados como cards (ícono+color por type, thumbnails de media con chip del modelo generador). Composer con Cmd/Ctrl+Enter, indicador de "trabajando…", auto-refresh cada 2,5 s conservando el scroll, y toggle del modo del orquestador (Consulta/Producción) con confirmación y badge del modo activo.
- **Resumen**: stepper de las 6 fases, título/logline, tabla de episodios con pipeline de 8 estados, decisiones pendientes.
- **Mapa**: grafo interactivo de agentes (SVG sin librerías): anillo en orden del pipeline con `studio` al centro, aristas estructurales vs. dinámicas, panel de perfil por agente y timeline por par, pulso de actividad reciente, auto-refresh cada 5 s.
- **Conversaciones**: feed del log de agentes, auto-refresh cada 3 s, color por agente y badge por tipo.
- **Galería**: grid por categoría/episodio con chip del modelo generador en cada card; click muestra metadata completa (prompt, modelo, agente, status); videos con controles.
- **Decisiones**: pendientes (con opciones) y resueltas (con respuesta y fecha).
- **Configuración**: una card por nivel de generación con proveedor/modelo, status y clave de API enmascarada; las claves viven solo en el `.env` local.

## i18n

Diccionarios en `locales/es.json` y `locales/en.json` (claves en inglés). Toggle ES/EN en el header, persistido en `localStorage` (`liniers.lang`), default `es`. Ninguna string de UI hardcodeada en componentes.

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

## Vistas

- **Resumen**: stepper de las 6 fases, título/logline, tabla de episodios con pipeline de 8 estados, decisiones pendientes.
- **Conversaciones**: feed del log de agentes, auto-refresh cada 3 s, color por agente y badge por tipo.
- **Galería**: grid por categoría/episodio; click muestra metadata (prompt, modelo, agente, status); videos con controles.
- **Decisiones**: pendientes (con opciones) y resueltas (con respuesta y fecha).

## i18n

Diccionarios en `locales/es.json` y `locales/en.json` (claves en inglés). Toggle ES/EN en el header, persistido en `localStorage` (`liniers.lang`), default `es`. Ninguna string de UI hardcodeada en componentes.

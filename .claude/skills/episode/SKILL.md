---
name: episode
description: Loop de escritura de un episodio - guionista escribe, supervisor de continuidad audita, se revisa hasta obtener PASS. Usar con el número de episodio como argumento (ej. /episode 1). Requiere segmentación hecha (/ingest).
---

# /episode <n>

Loop guion → continuidad → revisión para el episodio `epNN`.

**Precondiciones**: `source/segmentation.md` existe; el episodio está definido en `pipeline/state.json → episodes` (si no, crearlo desde la segmentación con estado `outline`).

## Loop (máximo 3 rondas)
1. **Escribir**: agente `episode-writer` — outline (si falta) y `script.<defaultLanguage>.md`. Estado → `draft` → `continuity_review`.
2. **Auditar**: agente `continuity-guardian` — reporte `story/continuity/epNN-r<n>.md` con veredicto.
3. **PASS** → estado `approved`, seguir al paso 4. **FAIL** → volver a 1 pasándole al guionista el reporte completo; nueva ronda.
4. **Espejos**: agente `localizer` para `script.en.md` (y demás idiomas activos).

Tras 3 rondas sin PASS: detenerse y presentar al usuario los BLOCKERs en disputa — es una decisión de dirección, no un loop infinito.

## Cierre
Resumen al usuario: estado final, escenas, hallazgos de continuidad resueltos y abiertos, y próximo paso (`/storyboard <n>` si `approved`). Todo movimiento de estado vía `scripts/state.mjs`; hitos al log vía `scripts/log.mjs`.

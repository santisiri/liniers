---
name: characters
description: Loop de diseño de personajes - fichas dramáticas y hojas de modelo visuales con referencias generadas por IA, hasta aprobación del director. Usar tras la segmentación, opcionalmente con slugs concretos (ej. /characters liniers beresford).
---

# /characters [slugs...]

Loop de diseño de personajes. Sin argumentos: todos los del reparto propuesto (`story/bible.md → dramatis personae`, priorizados por peso dramático) que no estén `approved`.

1. **Verificar `dec-001`** (estética visual) en `state.json`. Pendiente → las referencias serán `exploration`; avisarlo.
2. **Fichas**: agente `character-designer` por lote de personajes (fan-out con Workflow si son más de 3 — un agente por personaje, directorios disjuntos). Ficha en `story/characters/<slug>.md`.
3. **Hojas de modelo**: el mismo agente genera referencias vía MCP siguiendo el workflow `character-sheet` del servidor. Imágenes + `.meta.json` en `art/characters/<slug>/`.
4. **Continuidad**: agente `continuity-guardian` en pase rápido: coherencia entre fichas (edades, rangos, cronología de uniformes).
5. **Aprobación**: presentar al usuario las referencias por personaje (mostrar archivos) con la recomendación del diseñador; registrar aprobaciones en `state.json → characters` (`approved`) y prompts canónicos en las fichas.

Estado de personajes vía `scripts/state.mjs`; log por personaje. Cierre: tabla de personajes con estado y qué falta aprobar.

---
name: storyboard
description: Loop de storyboard de un episodio - shot list cinematográfica y paneles generados por IA a partir del guion aprobado. Usar con número de episodio (ej. /storyboard 1). Requiere episodio approved y personajes con ficha.
---

# /storyboard <n>

**Precondiciones**: episodio `epNN` en estado `approved` (si no, indicar `/episode <n>` primero); personajes de sus escenas con ficha (si faltan, indicar `/characters ...`).

1. **Shot list**: agente `storyboard-artist` — `art/storyboards/epNN/shotlist.md` completa antes de generar un solo panel (la estructura precede a la imagen).
2. **Paneles**: mismo agente, generación por tandas (batch MCP) escena por escena, con prompts canónicos de personajes incluidos. Paneles + `.meta.json` en `art/storyboards/epNN/`.
3. **Auditoría**: agente `continuity-guardian` sobre la shot list + paneles (geografía del damero, vestuario, clima, raccord entre escenas). FAIL → el storyboarder corrige los shots señalados (máximo 2 rondas).
4. **Revisión de dirección**: presentar al usuario la secuencia (archivos de paneles en orden) con las decisiones de cámara clave; dudas → registrarlas vía agente `creative-director`.

Estado: `storyboard` al empezar, `prompts` al entregar (`scripts/state.mjs`). Cierre: shots totales, paneles, hallazgos de continuidad, próximo paso `/shots <n>`.

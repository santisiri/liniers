---
name: director
description: Sesión de dirección - consolida todas las decisiones pendientes de estética, formato y cinematografía y las presenta al director humano con opciones y recomendación; registra y propaga sus respuestas. Usar cuando haya preguntas acumuladas o antes de fases que dependan de una decisión.
---

# /director

Sesión de decisiones con el director humano (Santiago).

1. **Consolidar**: agente `creative-director` — barrer `pipeline/log/conversations.jsonl` (entradas `question` sin resolver) y `state.json → decisions.pending`; fusionar duplicados, formalizar `dec-NNN` nuevos.
2. **Presentar**: máximo 4 decisiones por sesión, cada una con opciones concretas, consecuencia de cada opción en una línea y recomendación fundada primero. En sesión interactiva usar `AskUserQuestion`; si hay material visual comparable, mostrar los archivos antes de preguntar.
3. **Registrar**: cada respuesta → `resolved` en `state.json` (con `answer`, `answeredAt`), log `type: decision`.
4. **Propagar**: actualizar los documentos gobernados (`art/style-guide.md`, biblia, shot lists) y loguear handoffs a los agentes destrabados.

Cierre: decisiones resueltas hoy, las que quedan abiertas, y qué loops del pipeline quedaron habilitados (`/characters`, `/shots`, etc.).

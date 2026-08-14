---
name: shots
description: Loop de generación de shots de un episodio - prompt, generación de imagen clave, crítica contra storyboard y guía de estilo, refinamiento, y video final por shot. Usar con número de episodio (ej. /shots 1). Requiere storyboard entregado y estética resuelta.
---

# /shots <n>

**Precondiciones**: episodio `epNN` en estado `prompts`; `dec-001` (estética) resuelta — si está pendiente, ofrecer solo modo exploración o derivar a `/director`.

1. **Plan**: leer `art/storyboards/epNN/shotlist.md`; estado → `rendering`.
2. **Loop por shot** (agente `prompt-smith`; para más de 5 shots, fan-out con Workflow — un agente por escena, pipeline sin barreras): redactar → generar → criticar → refinar (máx. 4 iteraciones), imagen clave `candidate` con `.meta.json` en `art/renders/epNN/`.
3. **Video**: agente `render-producer` — imagen clave → video por shot (batch), cola y completados en `state.json → renders`, manifest `cut.json`, animatic si hay ffmpeg.
4. **Auditoría final**: `continuity-guardian` sobre los renders del episodio (raccord visual real, no solo prometido).
5. **Corte al director**: presentar la secuencia renderizada; aprobaciones shot a shot → `approved` en metadata. Episodio completo → estado `done`.

Shots que no convergen van al director vía `creative-director`, nunca a iteración infinita. Cierre: renderizados/pendientes, costo si el servidor lo expone, y próximo episodio sugerido.

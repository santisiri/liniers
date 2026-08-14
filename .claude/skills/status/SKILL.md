---
name: status
description: Estado del proyecto - reconcilia state.json con los archivos reales del repo, detecta inconsistencias, y presenta el tablero de situación (fases, episodios, decisiones, renders). Usar para retomar el trabajo o verificar salud del pipeline.
---

# /status

1. **Reconciliar**: comparar `pipeline/state.json` contra la realidad del repo — episodios declarados vs. archivos en `story/episodes/`, reportes de continuidad, personajes vs. fichas, renders vs. `.meta.json`. Corregir el estado donde la evidencia sea inequívoca (vía `scripts/state.mjs`); loguear lo corregido.
2. **Validar**: `state.json` contra `pipeline/schemas/state.schema.json`; JSONL del log parseable línea a línea.
3. **Presentar**: fase del proyecto, tabla de episodios con estado, decisiones pendientes, cola de renders, últimas 5 entradas del log, y el **próximo paso recomendado** (un solo comando).
4. Si el dashboard está corriendo, mencionar que se refresca solo (lee estos mismos archivos).

# Guía de estilo visual

> Estado: **pendiente de dirección**. La decisión `dec-001` (estética visual) está abierta; hasta que el director humano la resuelva, no se generan assets finales — solo exploraciones marcadas como `exploration` en su metadata.

## Decisiones abiertas (ver pipeline/state.json → decisions)
- `dec-001` estética visual (ilustración acuarela / grabado de época / pintura histórica / live-action estilizado)
- `dec-004` aspect ratio y cadencia

## Fijo (independiente de la estética elegida)
- **Época**: 1806–1807, Buenos Aires virreinal. Arquitectura baja, calles en damero, Plaza Mayor con Cabildo y Recova, el río llegando hasta lo que hoy es Leandro N. Alem.
- **Vestuario**: casacas rojas británicas (regimientos 71st Highlanders con kilts en 1806), milicias criollas heterogéneas, ponchos, uniformes de Patricios (azul con vivos rojos) recién a fines de 1806.
- **Luz**: invierno rioplatense (junio–agosto): luz baja, gris plata, barro. La Reconquista y la Defensa ocurren bajo lluvia y humedad.
- **Paleta tentativa**: barro y plata del río, rojo casaca como acento invasor, blanco/celeste apenas insinuado (aún no existe la bandera — no anacronizar).

## Anacronismos prohibidos
Bandera argentina (1812), Cabildo con su torre actual recortada, edificios republicanos, alambrado, eucaliptos (llegan después). Ante duda histórica: consultar biblia y marcar `question` en el log.

## Metadata obligatoria de cada asset
Sidecar `<archivo>.meta.json`: `{prompt, model, agent, ts, episode?, scene?, shot?, character?, seed?, status: "exploration"|"candidate"|"approved"}`.

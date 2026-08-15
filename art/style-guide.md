# Guía de estilo visual

> Estado: **estética resuelta por dirección** (2026-08-14): **live-action estilizado, 16:9** (dec-001, dec-004). La obra es ficción dialogada sin narrador (dec-003). Assets finales habilitados.

## Estética madre (dec-001: live-action estilizado)
- **Live-action cinematográfico generado**: fotorrealismo estilizado de producción de época premium, no documental ni ilustración. Referencia de energía: la multitud como protagonista visual (la fuente destaca los cuadros de Fouqueray porque "lo que resalta es la multitud" — trasladar ese principio compositivo al lenguaje live-action).
- **16:9** (dec-004). Composición pensada para streaming.
- **Cámara**: puesta clásica de drama histórico — plano/contraplano donde la palabra pesa, cámara que respira con la multitud en las escenas de masa; nada de estética de videojuego ni drone-shots anacrónicos de exhibición.
- **Textura**: grano fino de fílmico, contraste suave; la luz de invierno rioplatense (abajo) es la base tonal.
- **Idioma (dec-005, resuelta)**: película bilingüe — los británicos hablan inglés subtitulado; casting de voces en dos idiomas.

## Fijo (independiente de la estética elegida)
- **Época**: 1806–1807, Buenos Aires virreinal. Arquitectura baja, calles en damero, Plaza Mayor con Cabildo y Recova, el río llegando hasta lo que hoy es Leandro N. Alem.
- **Vestuario**: casacas rojas británicas (regimientos 71st Highlanders con kilts en 1806), milicias criollas heterogéneas, ponchos, uniformes de Patricios (azul con vivos rojos) recién a fines de 1806.
- **Luz**: invierno rioplatense (junio–agosto): luz baja, gris plata, barro. La Reconquista y la Defensa ocurren bajo lluvia y humedad.
- **Paleta tentativa**: barro y plata del río, rojo casaca como acento invasor, blanco/celeste apenas insinuado (aún no existe la bandera — no anacronizar).

## Anacronismos prohibidos
Bandera argentina (1812), Cabildo con su torre actual recortada, edificios republicanos, alambrado, eucaliptos (llegan después). Ante duda histórica: consultar biblia y marcar `question` en el log.

## Metadata obligatoria de cada asset
Sidecar `<archivo>.meta.json`: `{prompt, model, agent, ts, episode?, scene?, shot?, character?, seed?, status: "exploration"|"candidate"|"approved"}`.

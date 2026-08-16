VEREDICTO: PASS

# Reparto — pase de continuidad r1 (2026-08-15, continuity-guardian)

Alcance: las 14 fichas de `story/characters/*.md` y las hojas de modelo/retratos de `art/characters/*/` (alzaga, beresford, liniers, manuela-pedraza, marcela, people, sobremonte, whitelocke), contra `story/bible.md`, `story/glossary.md`, `art/style-guide.md`, `source/transcript/es/clean.md` y las decisiones dec-001–005. PASS con 1 MAJOR y 5 MINOR (regla: FAIL = 1 BLOCKER o 2 MAJOR). Los triviales ya quedaron corregidos (ver "Corregido por este pase").

## Hallazgos

- [MAJOR] beresford/model-sheet.png: **el ojo izquierdo ciego no se lee** en la hoja de modelo — en las vistas frontal y 3/4 ambos ojos aparecen simétricos, alertas y del mismo gris azulado, sin velado ni iris más pálido. Es el rasgo de identidad declarado por la ficha para continuidad "en cientos de shots"; si la referencia madre no lo porta, ningún shot derivado lo va a heredar. → Regenerar la lámina reforzando el velado en positivo (la lección anti-"no eye patch" ya está registrada en la ficha), o dejar constancia explícita de que `prompt-smith` debe forzar el rasgo shot a shot + VFX. Resolver antes de aprobar el diseño.
- [MINOR] sobremonte/model-sheet.png: rótulo de texto al pie ("CHARACTER TURNAROUND MODEL SHEET – 1806 SPANISH VICEREGAL COURTIER") pese al negative "no text". Ya documentado en Pendientes de la ficha; retocar o regenerar si se aprueba el diseño. (Mismo síntoma, menor, en los rótulos de whitelocke/expressions.png — ya anotado en su meta.)
- [MINOR] people/ensemble-sheet.png — changador (5º): pantalón azul arremangado que lee como **denim** (anacronismo moderno). Ya documentado como nota QC en la ficha `people`; corregir en v2 (debe ser calzón de lienzo crudo).
- [MINOR] people/ensemble-sheet.png — gaucho (6º): **no documentado en la nota QC de la ficha** — salió con pantalón gris liso y botas duras de cuero con espuelas metálicas en lugar de chiripá + botas de potro, y empuña un sable militar con guarnición en vez del facón a la espalda. Sumar a la lista de correcciones de la v2 junto con el denim del changador.
- [MINOR] marcela/model-sheet.png: el rostro lee ~28–32 frente a los 22 declarados por la ficha (casting 20–25). Parte es efecto deliberado del mandato anti-babyface ("linda como es linda la gente cansada"), pero verificar con dirección si esta edad percibida es la que se quiere fijar como referencia madre. (Manuela lee ~33–35 vs. 29: dentro de tolerancia para "piel curtida"; solo vigilar en retratos cercanos.)
- [MINOR] sobremonte/portrait.png (v2): la propia meta registra "una banderita azul lejana y un posible artefacto tipo espejo en la carreta" — revisar antes de usar como referencia aprobada (riesgo de leerse como insignia; la única bandera legal en 1806–07 es la española o la británica).

## Corregido por este pase (triviales)

1. `story/characters/liniers.md`: encabezado de vestuario "### 1807 (virrey interino / la Defensa — ep02 final y ep03)" → "### Agosto de 1806 → 1807 (virrey impuesto por el pueblo …)". La imposición como virrey ocurre en el cabildo del 13–14/8/1806 (ep02, [30:19]); el encabezado "1807" contradecía su propio "ep02 final".
2. `story/characters/sobremonte.md`: encabezado "### 1807 (ep02 final — deposición)" → "### Agosto de 1806 (ep02 final — deposición)". La deposición de hecho es el cabildo de agosto de 1806 [29:32–30:19], no 1807.
3. `art/characters/liniers/portrait.png.meta.json` y `art/characters/alzaga/portrait.png.meta.json`: agregado el campo `seed` (288009 y 224349) que la ficha documenta y faltaba en el sidecar.
4. Agregado `job_id` (documentado en las fichas, requerido por `prompt-smith` como media de referencia) a los metas de: marcela/model-sheet, marcela/portrait, manuela-pedraza/model-sheet, manuela-pedraza/portrait, people/ensemble-sheet, people/crowd-frame.

## Verificado

- **Cronología y edades**: coherentes en las 14 fichas; todas las edades avanzan +1 entre 1806 y 1807 y cierran con las fechas de nacimiento citadas (Beresford ~38/1768, Popham ~43/1762, Sobremonte ~61/1745, Álzaga 51/1755, Whitelocke 50/1757, Belgrano 36/1770, Güemes 21/1785, Pueyrredón 28/1777, Saavedra 46→47/1759; Liniers sigue la fuente: 50 [19:11], con la divergencia historiográfica marcada). Las edades de los prompts de generación coinciden con las fichas (22, 29, 38, 50, 51, 61; ensamble 24/52/35/48/30/28/58/40/8).
- **Rangos por fecha**: brigadier-general (Beresford 1806, marcado "a verificar"), teniente general (Whitelocke 1807), comodoro RN (Popham), capitán de navío (Liniers 1806), cadete del Fijo (Güemes) — sin cruces contradictorios.
- **Cronología de uniformes**: Patricios "recién a fines de 1806" respetado en todas las fichas que lo tocan (`people/miliciano` combate el 12/8 SIN uniforme; Saavedra estrena el azul con vivos rojos en el discurso de diciembre); 71st Highlanders con kilt presente en `crowd-frame.png` y su prompt; casacas por regimiento consistentes (general británico rojo/vueltas azules, marines rojo/vueltas azules, Royal Navy azul — reservado a Popham por decisión de paleta, naval español azul/vueltas rojas).
- **Anacronismos prohibidos** (`art/style-guide.md`): sin bandera argentina, escarapelas, eucaliptos ni alambrados en ninguna lámina; las 3 excepciones detectadas están arriba (denim del changador, banderita azul del retrato de Sobremonte, gaucho fuera de ficha).
- **Cruces entre fichas**: Beresford↔Popham↔Gillespie (1.600 hombres, Cabo de Buena Esperanza, fonda a las cinco horas) consistentes; Marcela↔Gillespie coordinadas y mutuamente referenciadas como base documental (la escena de la fonda se recrea como ficción propia, dec-003, en ambas); Liniers↔Sobremonte↔Álzaga (cabildo, deposición, túneles, Miserere, Defensa "con Álzaga detrás") consistentes entre sí, con la biblia y el glosario; pesos ★ de las 14 fichas idénticos al dramatis afinado de la biblia.
- **dec-005**: las cuatro fichas británicas (beresford, popham, gillespie, whitelocke) declaran "Idioma en escena: inglés, subtitulado"; los criollos declaran explícitamente que dec-005 no les aplica inglés; Liniers (francés) y Sobremonte (peninsular) usan el acento como material dramático — sin contradicciones.
- **Hojas de modelo vs. ficha**: liniers, sobremonte, alzaga, whitelocke, manuela-pedraza, marcela y people(ensamble/crowd) obedecen rasgos, edad y vestuario de su ficha (salvo los hallazgos listados); los prompts canónicos citados en las fichas son **idénticos byte a byte** a los de los sidecars (verificado por diff).
- **Metadata**: los 27 sidecars `.meta.json` tienen `prompt, model, agent, ts, character, status`; todas las hojas de modelo/láminas madre en `status: "candidate"` (los descartes v1/v2/alt correctamente en `"exploration"`).
- **Fichas sin arte todavía** (popham, gillespie, belgrano, guemes, pueyrredon, saavedra): declaran "hoja de modelo pendiente" — consistente con su estado.

## Riesgos mirando adelante

1. **El ojo de Beresford**: si no se resuelve en la referencia madre, es el error de continuidad más probable de toda la serie (aparece en decenas de shots de ep01–ep02).
2. **Transiciones de vestuario 1806→fines de 1806→1807** (Patricios, Liniers marino→virrey, casaca del changador): el storyboard deberá etiquetar cada escena con fecha para que `prompt-smith` elija la variante correcta — las fichas ya lo permiten, el pipeline aún no lo exige.
3. **Los 6 personajes sin hoja de modelo** (popham, gillespie, belgrano, guemes, pueyrredon, saavedra): generar antes del storyboard de ep01/ep02 para no improvisar rostros en paneles; gillespie además arrastra decisiones de diseño (cuaderno, medio-castellano, presencia en ep02/ep03) que requieren aprobación del director antes de guion.

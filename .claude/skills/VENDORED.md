# Skills vendoreados desde anthropics/skills

Fuente: https://github.com/anthropics/skills — clon superficial en `vendor/anthropic-skills/` (gitignored, referencia local).
Commit: `f6656c1256d5a8adfa37db9110046ef20bac644c` (2026-08-13).

Los skills propios del pipeline (`ingest`, `episode`, `characters`, `storyboard`, `shots`, `director`, `status`) no se tocan; ante colisión de nombres, el propio gana. No hubo colisiones.

## Vendoreados en `.claude/skills/`

| Skill | Por qué en este proyecto |
|---|---|
| `webapp-testing` | Probar el dashboard Next.js con Playwright: verificación de UI, screenshots, logs de navegador. |
| `frontend-design` | Dirección estética del dashboard: tipografía, diseño intencional, evitar look templated. |
| `canvas-design` | Piezas visuales estáticas (.png/.pdf) con filosofía de diseño: posters, arte promocional, material de la guía de estilo. |
| `web-artifacts-builder` | Artifacts HTML complejos (React, Tailwind, shadcn/ui) para vistas ricas: reportes visuales, prototipos de UI del estudio. |
| `skill-creator` | Crear/mejorar/medir los skills propios del pipeline (evals, benchmarks, optimización de descripciones). |
| `mcp-builder` | Productización futura: exponer el estudio como servicio vía servidor MCP (Python FastMCP o TypeScript SDK). |

Cada skill se copió completo, incluyendo su `LICENSE.txt` (Apache 2.0 en los seis casos).

## Catálogo completo del repo (disponible en `vendor/anthropic-skills/` sin copiar)

Estructura: `skills/` (17 skills, planos — no existe hoy un subdirectorio `document-skills`; los de documentos viven directo en `skills/`), `spec/` (especificación Agent Skills), `template/` (plantilla de SKILL.md), `THIRD_PARTY_NOTICES.md`.

| Skill | Qué hace | Estado |
|---|---|---|
| `algorithmic-art` | Arte generativo con p5.js: seeded randomness, flow fields, sistemas de partículas. | En vendor/ (posible futuro: texturas/títulos procedurales). |
| `brand-guidelines` | Aplica colores y tipografía oficiales de Anthropic a artifacts. | No copiado (branding ajeno al proyecto). |
| `canvas-design` | Arte visual estático en .png/.pdf con filosofía de diseño. | **Vendoreado.** |
| `claude-api` | Referencia de la API de Claude (modelos, precios, streaming, tool use). | No copiado (ya disponible en el entorno). |
| `doc-coauthoring` | Workflow estructurado de co-escritura de docs/propuestas/specs. | En vendor/. |
| `docx` | Crear/leer/editar documentos Word. | No copiado (ya en el entorno). |
| `frontend-design` | Diseño visual distintivo e intencional para UI. | **Vendoreado.** |
| `internal-comms` | Comunicaciones internas de empresa (status reports, newsletters). | No copiado (fuera de alcance). |
| `mcp-builder` | Crear servidores MCP de calidad (Python/TypeScript). | **Vendoreado.** |
| `pdf` | Manipulación completa de PDFs. | No copiado (ya en el entorno). |
| `pptx` | Crear/editar presentaciones PowerPoint. | No copiado (ya en el entorno). |
| `skill-creator` | Crear, mejorar y evaluar skills. | **Vendoreado.** |
| `slack-gif-creator` | GIFs animados optimizados para Slack. | No copiado (fuera de alcance). |
| `theme-factory` | 10 temas preset (colores/fuentes) para estilizar artifacts. | En vendor/ (posible utilidad para reportes). |
| `web-artifacts-builder` | Artifacts HTML multi-componente con React/Tailwind/shadcn. | **Vendoreado.** |
| `webapp-testing` | Testing de webapps locales con Playwright. | **Vendoreado.** |
| `xlsx` | Crear/editar hojas de cálculo. | No copiado (ya en el entorno). |

Para actualizar: `cd vendor/anthropic-skills && git pull --depth 1`, revisar diff de los seis vendoreados y re-copiar.

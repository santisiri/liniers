# Liniers

**ES** — Estudio cinematográfico multiagente. Una película episódica sobre las Invasiones Inglesas de Buenos Aires (1806–1807), construida desde la narración de un video fuente mediante un pipeline de agentes: guion → continuidad → diseño de personajes → storyboard → prompts → render. Incluye un dashboard para seguir el progreso, las conversaciones entre agentes y la obra renderizada.

**EN** — A multi-agent film studio. An episodic film about the British Invasions of Buenos Aires (1806–1807), built from the narration of a source video through an agent pipeline: script → continuity → character design → storyboard → prompts → render. Includes a dashboard to follow progress, inter-agent conversations, and the rendered work.

## Cómo funciona / How it works

- La constitución del estudio vive en [CLAUDE.md](CLAUDE.md): mapa del repo, máquina de estados, protocolos.
- Los agentes están definidos en `.claude/agents/` y los loops del pipeline en `.claude/skills/` (invocables como `/ingest`, `/episode 1`, `/storyboard 1`, `/shots 1`, `/director`…).
- El estado del proyecto es `pipeline/state.json`; la conversación del estudio es `pipeline/log/conversations.jsonl`.

## Dashboard

```bash
cd dashboard && npm install && npm run dev
```

Abre `http://localhost:3000` — vista de fases, episodios, feed de conversaciones de agentes, galería de renders y decisiones de dirección. Interfaz en español e inglés.

## Requisitos de ingesta / Ingest requirements

`yt-dlp` y `whisper` (u otro transcriptor) para `/ingest`. Ver `scripts/README.md`.

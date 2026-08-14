---
name: ingest
description: Ingesta del video fuente - descarga el video de YouTube, transcribe la alocución con timestamps y lanza el análisis y segmentación en episodios. Usar al inicio del proyecto o si cambia el video fuente. Argumento - la URL de YouTube (o se toma de source/video.json).
---

# /ingest <youtube-url>

Loop de ingesta del material fuente.

1. **URL**: del argumento o `source/video.json → youtubeUrl`. Sin URL, pedirla y detenerse. Guardarla en `source/video.json` y en `pipeline/state.json → source.youtubeUrl`.
2. **Descarga + transcripción**: `node scripts/ingest.mjs --url <url>`. El script verifica `yt-dlp` y `whisper`; si faltan, imprime instrucciones de instalación — mostrarlas al usuario y detenerse. Salidas: `source/media/` (audio) y `source/transcript/es/raw.{txt,srt,json}`.
3. **Análisis**: lanzar el agente `transcript-analyst` (Agent tool) para limpieza (`clean.md`), segmentación (`source/segmentation.md`), glosario y propuesta de reparto. Actualiza la biblia (`story/bible.md`) con lo que la narración realmente dice.
4. **Estado**: fase a `ingest` al empezar y `bible` al terminar (`scripts/state.mjs phase ...`). Logs vía `scripts/log.mjs`.
5. **Cierre**: presentar al usuario los cortes de episodio propuestos y las preguntas nuevas para dirección; sugerir `/director` como próximo paso.

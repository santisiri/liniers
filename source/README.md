# Fuente

- `video.json` — URL del video de YouTube y metadata. **Pendiente: pegar la URL de la alocución.**
- `media/` — audio/video descargado por `/ingest` (gitignored, pesado).
- `transcript/<lang>/` — transcripción cruda (`raw.txt`, `raw.srt`, `raw.json` con timestamps) y limpia (`clean.md`).
- `segmentation.md` — propuesta de cortes en episodios producida por `transcript-analyst`, con beats y referencias de timestamp.

La transcripción con timestamps es sagrada: es el vínculo entre la narración original y cada escena de la película.

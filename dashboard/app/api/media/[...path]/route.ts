import { promises as fs } from "fs";
import path from "path";
import { artRoot } from "@/lib/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4"
};

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await context.params;
  if (!segments || segments.length === 0) {
    return new Response(null, { status: 404 });
  }

  const base = path.resolve(artRoot());
  const resolved = path.resolve(base, ...segments);

  // Path-traversal guard: the resolved file must stay inside art/.
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    return new Response(null, { status: 404 });
  }

  const contentType = CONTENT_TYPES[path.extname(resolved).toLowerCase()];
  if (!contentType) {
    return new Response(null, { status: 404 });
  }

  let data: Buffer;
  try {
    const stat = await fs.stat(resolved);
    if (!stat.isFile()) return new Response(null, { status: 404 });
    data = await fs.readFile(resolved);
  } catch {
    return new Response(null, { status: 404 });
  }

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-cache"
  };

  // Minimal single-range support so <video> seeking works (Safari requires it).
  const range = request.headers.get("range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (match && (match[1] || match[2])) {
      const size = data.byteLength;
      let start = match[1] ? Number.parseInt(match[1], 10) : 0;
      let end = match[2] ? Number.parseInt(match[2], 10) : size - 1;
      if (!match[1]) {
        // suffix range: last N bytes
        start = Math.max(size - Number.parseInt(match[2], 10), 0);
        end = size - 1;
      }
      end = Math.min(end, size - 1);
      if (start >= 0 && start <= end) {
        const chunk = data.subarray(start, end + 1);
        headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
        headers["Content-Length"] = String(chunk.byteLength);
        return new Response(chunk as unknown as BodyInit, { status: 206, headers });
      }
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` }
      });
    }
  }

  headers["Content-Length"] = String(data.byteLength);
  return new Response(data as unknown as BodyInit, { status: 200, headers });
}

import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { artRoot } from "@/lib/paths";
import { GALLERY_CATEGORIES } from "@/lib/constants";
import type {
  AssetMeta,
  GalleryCategory,
  GalleryGroup,
  GalleryItem,
  GalleryPayload
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MEDIA_KIND: Record<string, "image" | "video"> = {
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
  ".webp": "image",
  ".mp4": "video"
};

async function collectFiles(dir: string, relBase: string, out: string[]): Promise<void> {
  let dirents;
  try {
    dirents = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return; // category directory missing: treat as empty
  }
  for (const dirent of dirents) {
    if (dirent.name.startsWith(".")) continue;
    const rel = relBase ? `${relBase}/${dirent.name}` : dirent.name;
    if (dirent.isDirectory()) {
      await collectFiles(path.join(dir, dirent.name), rel, out);
    } else if (MEDIA_KIND[path.extname(dirent.name).toLowerCase()]) {
      out.push(rel);
    }
  }
}

async function readMeta(absFile: string): Promise<AssetMeta | null> {
  try {
    const raw = await fs.readFile(`${absFile}.meta.json`, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as AssetMeta;
    }
  } catch {
    // no sidecar or corrupt sidecar: no metadata
  }
  return null;
}

function episodeOf(relPath: string, meta: AssetMeta | null): string | null {
  if (meta?.episode && typeof meta.episode === "string") return meta.episode;
  const match = relPath.match(/ep\d+/i);
  return match ? match[0].toLowerCase() : null;
}

export async function GET() {
  const base = artRoot();
  const categories: GalleryCategory[] = [];

  for (const category of GALLERY_CATEGORIES) {
    const catDir = path.join(base, category);
    const files: string[] = [];
    await collectFiles(catDir, "", files);
    files.sort();

    const byEpisode = new Map<string, GalleryItem[]>();
    for (const rel of files) {
      const abs = path.join(catDir, rel);
      const meta = await readMeta(abs);
      const relPath = `${category}/${rel}`;
      const item: GalleryItem = {
        name: path.basename(rel),
        relPath,
        url: `/api/media/${relPath.split("/").map(encodeURIComponent).join("/")}`,
        kind: MEDIA_KIND[path.extname(rel).toLowerCase()],
        episode: episodeOf(relPath, meta),
        meta
      };
      const key = item.episode ?? "";
      const bucket = byEpisode.get(key);
      if (bucket) bucket.push(item);
      else byEpisode.set(key, [item]);
    }

    const groups: GalleryGroup[] = [...byEpisode.entries()]
      .sort(([a], [b]) => {
        if (a === "") return 1; // "general" (no episode) last
        if (b === "") return -1;
        return a.localeCompare(b);
      })
      .map(([episode, items]) => ({ episode: episode || null, items }));

    categories.push({ id: category, count: files.length, groups });
  }

  const payload: GalleryPayload = { categories };
  return NextResponse.json(payload);
}

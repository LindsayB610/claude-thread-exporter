import { access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { slugify } from "./slug.js";
import type { ExportFormat } from "./types.js";

export async function resolveDefaultOutPath(
  title: string,
  format: ExportFormat,
  downloads = path.join(os.homedir(), "Downloads")
): Promise<string> {
  const base = `${slugify(title)}-claude-export`;
  return uniquePath(path.join(downloads, `${base}.${format}`));
}

async function uniquePath(candidate: string): Promise<string> {
  const parsed = path.parse(candidate);
  let current = candidate;
  let index = 2;

  while (await exists(current)) {
    current = path.join(parsed.dir, `${parsed.name}-${index}${parsed.ext}`);
    index += 1;
  }

  return current;
}

async function exists(candidate: string): Promise<boolean> {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

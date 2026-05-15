import { readFile } from "node:fs/promises";
import type { ClaudeSnapshot } from "./types.js";

export async function readSnapshotFile(path: string): Promise<ClaudeSnapshot> {
  const raw = await readFile(path, "utf8");
  return parseSnapshotJson(raw);
}

export function parseSnapshotJson(raw: string): ClaudeSnapshot {
  const parsed: unknown = JSON.parse(raw);
  const snapshot = findSnapshotPayload(parsed);
  if (!snapshot) {
    throw new Error("Snapshot JSON did not contain a Claude chat snapshot payload.");
  }
  return snapshot;
}

export function findSnapshotPayload(value: unknown): ClaudeSnapshot | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (isClaudeSnapshot(value)) {
    return value;
  }

  if ("snapshot" in value) {
    const snapshot = findSnapshotPayload((value as { snapshot?: unknown }).snapshot);
    if (snapshot) {
      return snapshot;
    }
  }

  if ("data" in value) {
    const snapshot = findSnapshotPayload((value as { data?: unknown }).data);
    if (snapshot) {
      return snapshot;
    }
  }

  return null;
}

function isClaudeSnapshot(value: object): value is ClaudeSnapshot {
  return "chat_messages" in value && Array.isArray((value as { chat_messages?: unknown }).chat_messages);
}

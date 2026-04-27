import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/http";

export async function saveBuffer(storageKey: string, buffer: Buffer) {
  const fullPath = resolveStoragePath(storageKey);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, buffer);
  return fullPath;
}

export async function readBuffer(storageKey: string) {
  return readFile(resolveStoragePath(storageKey));
}

export async function statBuffer(storageKey: string) {
  return stat(resolveStoragePath(storageKey));
}

export function assetFileUrl(assetId: string) {
  return `/api/assets/${assetId}/file`;
}

function resolveStoragePath(storageKey: string) {
  if (path.isAbsolute(storageKey)) {
    throw new HttpError(400, "Invalid asset storage path", "invalid_storage_path");
  }

  const root = path.resolve(env.UPLOAD_DIR);
  const fullPath = path.resolve(root, storageKey);
  if (fullPath !== root && !fullPath.startsWith(`${root}${path.sep}`)) {
    throw new HttpError(400, "Invalid asset storage path", "invalid_storage_path");
  }

  return fullPath;
}

import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { StoredUpload } from "@/lib/uploads/types/upload";

const uploadRoot = path.join(process.cwd(), "storage", "uploads");

function safeFilename(filename: string) {
  const extension = path.extname(filename);
  const base = path
    .basename(filename, extension)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);

  return `${base || "upload"}${extension.toLowerCase()}`;
}

export class LocalStorageProvider {
  async put(input: {
    organizationId: string;
    documentId: string;
    file: File;
  }): Promise<StoredUpload> {
    const buffer = Buffer.from(await input.file.arrayBuffer());
    const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
    const filename = safeFilename(input.file.name);
    const storageKey = path.join(input.organizationId, input.documentId, filename);
    const absolutePath = path.join(uploadRoot, storageKey);

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, buffer);

    return {
      storageKey,
      absolutePath,
      size: buffer.length,
      checksum,
    };
  }

  async get(storageKey: string) {
    return readFile(path.join(uploadRoot, storageKey));
  }
}

export const localStorageProvider = new LocalStorageProvider();

import crypto from "node:crypto";

import { env } from "@/lib/env";

function keyMaterial() {
  const key = env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error("ENCRYPTION_KEY is required for secret encryption.");
  }

  return crypto.createHash("sha256").update(key).digest();
}

export class SecretManager {
  encrypt(secret: string) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", keyMaterial(), iv);
    const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
  }

  decrypt(payload: string) {
    const [ivRaw, tagRaw, encryptedRaw] = payload.split(".");

    if (!ivRaw || !tagRaw || !encryptedRaw) {
      throw new Error("Invalid encrypted secret payload.");
    }

    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      keyMaterial(),
      Buffer.from(ivRaw, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagRaw, "base64"));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedRaw, "base64")),
      decipher.final(),
    ]).toString("utf8");
  }
}

export const secretManager = new SecretManager();

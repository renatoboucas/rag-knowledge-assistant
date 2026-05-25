import { describe, expect, it } from "vitest";

import {
  apiKeyPrefix,
  generateApiKeySecret,
  hashApiKey,
  hasScope,
  redactApiKey,
} from "@/lib/developer/api-key-service";

describe("api key helpers", () => {
  it("generates redacted RAG assistant API keys", () => {
    const secret = generateApiKeySecret();
    const prefix = apiKeyPrefix(secret);

    expect(secret).toMatch(/^rka_[A-Za-z0-9_-]+$/);
    expect(prefix).toMatch(/^rka_[A-Za-z0-9_-]{8}$/);
    expect(redactApiKey(prefix)).toBe(`${prefix}...`);
  });

  it("hashes keys deterministically without exposing the secret", () => {
    const secret = "rka_test_secret";

    expect(hashApiKey(secret)).toBe(hashApiKey(secret));
    expect(hashApiKey(secret)).not.toContain(secret);
    expect(hashApiKey(secret)).toHaveLength(64);
  });

  it("checks exact and wildcard scopes", () => {
    expect(hasScope(["documents:read"], "documents:read")).toBe(true);
    expect(hasScope(["*"], "retrieval:read")).toBe(true);
    expect(hasScope(["documents:read"], "retrieval:read")).toBe(false);
  });
});

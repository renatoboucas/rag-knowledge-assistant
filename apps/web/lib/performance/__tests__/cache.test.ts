import { describe, expect, it, vi } from "vitest";

import { cacheKey, getOrSetCache, invalidateCache } from "@/lib/performance/cache";

describe("performance cache", () => {
  it("reuses cached values until invalidated", async () => {
    const key = cacheKey(["unit", "cache"]);
    const factory = vi.fn(async () => ({ value: crypto.randomUUID() }));

    const first = await getOrSetCache(key, 60, factory);
    const second = await getOrSetCache(key, 60, factory);

    expect(second).toBe(first);
    expect(factory).toHaveBeenCalledTimes(1);

    invalidateCache("unit");
    await getOrSetCache(key, 60, factory);

    expect(factory).toHaveBeenCalledTimes(2);
  });
});

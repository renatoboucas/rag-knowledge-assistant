import { describe, expect, it } from "vitest";

import { estimateTokenCount, truncateToTokenBudget } from "@/lib/memory/token-counter";

describe("token-counter", () => {
  it("estimates empty text as zero tokens", () => {
    expect(estimateTokenCount("   ")).toBe(0);
  });

  it("truncates text to a token budget", () => {
    const text = "a".repeat(100);
    expect(truncateToTokenBudget(text, 10)).toHaveLength(40);
  });
});

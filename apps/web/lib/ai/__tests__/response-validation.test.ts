import { describe, expect, it } from "vitest";

import { validateAiResponse } from "@/lib/ai/response-validation";

describe("validateAiResponse", () => {
  it("accepts cited grounded responses", () => {
    const result = validateAiResponse({
      answer: "The policy requires tenant isolation [S1] and audit logging [S2].",
      requiredCitationIds: ["S1"],
      retrievalRisk: "low",
    });

    expect(result.valid).toBe(true);
    expect(result.citationIds).toEqual(["S1", "S2"]);
  });

  it("flags missing citations and uncertainty language", () => {
    const result = validateAiResponse({
      answer: "The answer is definitely available.",
      retrievalRisk: "high",
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toContain("missing_citation");
    expect(result.issues).toContain("missing_uncertainty_qualification");
  });
});

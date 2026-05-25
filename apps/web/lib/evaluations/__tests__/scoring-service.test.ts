import { describe, expect, it } from "vitest";

import { evaluationScoring } from "@/lib/evaluations/scoring-service";
import type { RetrievalEvaluation } from "@/lib/rag/types/retrieval";

const lowRiskRetrieval: RetrievalEvaluation = {
  groundedness: 0.95,
  coverage: 0.9,
  diversity: 0.75,
  risk: "low",
  warnings: [],
};

const highRiskRetrieval: RetrievalEvaluation = {
  groundedness: 0.2,
  coverage: 0.25,
  diversity: 0.1,
  risk: "high",
  warnings: ["low_similarity"],
};

describe("EvaluationScoringService", () => {
  it("scores grounded cited answers as low risk", () => {
    const result = evaluationScoring.score({
      answer:
        "Tenant data is protected with RBAC, audit logging, rate limiting, and data isolation [S1].",
      context:
        "Tenant data is protected with RBAC, audit logging, rate limiting, and data isolation.",
      expectedAnswer:
        "Tenant data is protected with RBAC, audit logs, rate limiting, and data isolation.",
      expectedCitationIds: ["S1"],
      expectedDocuments: ["doc-security"],
      requiredKeywords: ["RBAC", "audit", "data isolation"],
      retrievedCitationIds: ["S1"],
      retrievedDocumentIds: ["doc-security"],
      retrievalEvaluation: lowRiskRetrieval,
    });

    expect(result.risk).toBe("low");
    expect(result.overallScore).toBeGreaterThan(0.8);
    expect(result.issues).toEqual([]);
  });

  it("flags unsupported answers with weak retrieval signals", () => {
    const result = evaluationScoring.score({
      answer: "The platform guarantees every answer is correct [S9].",
      context: "The retrieved context only discusses document ingestion and chunking.",
      expectedAnswer:
        "The assistant should acknowledge insufficient context and avoid unsupported claims.",
      expectedCitationIds: ["S1"],
      expectedDocuments: ["doc-governance"],
      requiredKeywords: ["insufficient", "unsupported"],
      retrievedCitationIds: ["S1"],
      retrievedDocumentIds: ["doc-ingestion"],
      retrievalEvaluation: highRiskRetrieval,
    });

    expect(result.risk).toBe("high");
    expect(result.issues).toContain("unsupported_citations");
    expect(result.issues).toContain("missing_uncertainty_for_high_risk_retrieval");
    expect(result.issues).toContain("missing_required_keywords");
    expect(result.issues).toContain("weak_retrieval");
  });
});

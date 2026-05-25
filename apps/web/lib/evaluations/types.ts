import type { RetrievalEvaluation } from "@/lib/rag/types/retrieval";

export type EvaluationCaseInput = {
  query: string;
  expectedAnswer?: string | null;
  expectedCitationIds?: string[];
  expectedDocuments?: string[];
  requiredKeywords?: string[];
  metadata?: Record<string, unknown>;
};

export type EvaluationScores = {
  retrievalScore: number;
  hallucinationScore: number;
  responseQualityScore: number;
  overallScore: number;
  risk: "low" | "medium" | "high";
  issues: string[];
  metadata: {
    citationRecall: number;
    documentRecall: number;
    keywordCoverage: number;
    answerOverlap: number;
    retrievalEvaluation: RetrievalEvaluation;
  };
};

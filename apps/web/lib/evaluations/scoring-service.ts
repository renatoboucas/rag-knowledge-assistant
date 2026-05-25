import type { RetrievalEvaluation } from "@/lib/rag/types/retrieval";
import type { EvaluationScores } from "./types";

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function recall(expected: string[], actual: string[]) {
  const expectedSet = new Set(unique(expected));

  if (!expectedSet.size) {
    return 1;
  }

  const actualSet = new Set(unique(actual));
  let hits = 0;

  for (const item of expectedSet) {
    if (actualSet.has(item)) {
      hits += 1;
    }
  }

  return hits / expectedSet.size;
}

function answerOverlap(answer: string, expectedAnswer?: string | null) {
  if (!expectedAnswer) {
    return 1;
  }

  return recall(tokenize(expectedAnswer), tokenize(answer));
}

function keywordCoverage(answer: string, requiredKeywords: string[]) {
  if (!requiredKeywords.length) {
    return 1;
  }

  const normalized = answer.toLowerCase();
  return (
    requiredKeywords.filter((keyword) => normalized.includes(keyword.toLowerCase())).length /
    requiredKeywords.length
  );
}

function citedIds(answer: string) {
  return unique([...answer.matchAll(/\[S\d+\]/g)].map((match) => match[0].slice(1, -1)));
}

export class EvaluationScoringService {
  score(input: {
    answer: string;
    context: string;
    expectedAnswer?: string | null;
    expectedCitationIds: string[];
    expectedDocuments: string[];
    requiredKeywords: string[];
    retrievedCitationIds: string[];
    retrievedDocumentIds: string[];
    retrievalEvaluation: RetrievalEvaluation;
  }): EvaluationScores {
    const issues: string[] = [];
    const citationRecall = recall(input.expectedCitationIds, input.retrievedCitationIds);
    const documentRecall = recall(input.expectedDocuments, input.retrievedDocumentIds);
    const retrievalScore = clamp(
      input.expectedCitationIds.length || input.expectedDocuments.length
        ? citationRecall * 0.45 +
            documentRecall * 0.35 +
            input.retrievalEvaluation.groundedness * 0.2
        : input.retrievalEvaluation.groundedness * 0.5 +
            input.retrievalEvaluation.coverage * 0.3 +
            input.retrievalEvaluation.diversity * 0.2,
    );

    const citations = citedIds(input.answer);
    const unsupportedCitations = citations.filter(
      (citationId) => !input.retrievedCitationIds.includes(citationId),
    );
    const contextTokens = new Set(tokenize(input.context));
    const answerTokens = tokenize(input.answer);
    const groundedTokenRatio = answerTokens.length
      ? answerTokens.filter((token) => contextTokens.has(token)).length / answerTokens.length
      : 0;
    const hallucinationScore = clamp(
      0.45 +
        groundedTokenRatio * 0.35 -
        unsupportedCitations.length * 0.2 +
        (citations.length ? 0.2 : 0),
    );

    if (!input.answer.trim()) {
      issues.push("empty_answer");
    }

    if (unsupportedCitations.length) {
      issues.push("unsupported_citations");
    }

    if (
      input.retrievalEvaluation.risk === "high" &&
      !/not enough|insufficient|cannot determine|unclear/i.test(input.answer)
    ) {
      issues.push("missing_uncertainty_for_high_risk_retrieval");
    }

    const keywordScore = keywordCoverage(input.answer, input.requiredKeywords);
    const overlapScore = answerOverlap(input.answer, input.expectedAnswer);
    const citationScore = input.expectedCitationIds.length
      ? citationRecall
      : citations.length
        ? 1
        : 0.65;
    const lengthScore = input.answer.length > 32 && input.answer.length < 2400 ? 1 : 0.7;
    const responseQualityScore = clamp(
      keywordScore * 0.35 + overlapScore * 0.3 + citationScore * 0.25 + lengthScore * 0.1,
    );

    if (keywordScore < 0.75) {
      issues.push("missing_required_keywords");
    }

    if (overlapScore < 0.35) {
      issues.push("low_reference_overlap");
    }

    if (retrievalScore < 0.5) {
      issues.push("weak_retrieval");
    }

    const overallScore = clamp(
      retrievalScore * 0.35 + hallucinationScore * 0.35 + responseQualityScore * 0.3,
    );
    const risk =
      overallScore < 0.5 || hallucinationScore < 0.45
        ? "high"
        : overallScore < 0.75
          ? "medium"
          : "low";

    return {
      retrievalScore,
      hallucinationScore,
      responseQualityScore,
      overallScore,
      risk,
      issues: unique(issues),
      metadata: {
        citationRecall,
        documentRecall,
        keywordCoverage: keywordScore,
        answerOverlap: overlapScore,
        retrievalEvaluation: input.retrievalEvaluation,
      },
    };
  }
}

export const evaluationScoring = new EvaluationScoringService();

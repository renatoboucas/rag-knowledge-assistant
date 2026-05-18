export type AiResponseValidationInput = {
  answer: string;
  requiredCitationIds?: string[];
  requireCitation?: boolean;
  retrievalRisk?: "low" | "medium" | "high";
};

export type AiResponseValidationResult = {
  valid: boolean;
  score: number;
  issues: string[];
  citationIds: string[];
};

const uncertaintyMarkers = [
  "not enough context",
  "insufficient context",
  "the provided context",
  "based on the retrieved context",
  "cannot determine",
  "unclear",
];

export function validateAiResponse(input: AiResponseValidationInput): AiResponseValidationResult {
  const citationIds = [...input.answer.matchAll(/\[S\d+\]/g)].map((match) => match[0].slice(1, -1));
  const issues: string[] = [];

  if (input.requireCitation !== false && citationIds.length === 0) {
    issues.push("missing_citation");
  }

  for (const citationId of input.requiredCitationIds ?? []) {
    if (!citationIds.includes(citationId)) {
      issues.push(`missing_required_citation:${citationId}`);
    }
  }

  if (
    (input.retrievalRisk === "medium" || input.retrievalRisk === "high") &&
    !uncertaintyMarkers.some((marker) => input.answer.toLowerCase().includes(marker))
  ) {
    issues.push("missing_uncertainty_qualification");
  }

  const score = Math.max(0, 1 - issues.length * 0.25);

  return {
    valid: issues.length === 0,
    score,
    issues,
    citationIds,
  };
}

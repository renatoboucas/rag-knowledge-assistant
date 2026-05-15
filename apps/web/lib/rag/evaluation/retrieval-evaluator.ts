import type {
  QueryPreprocessingResult,
  RankedContext,
  RetrievalEvaluation,
} from "@/lib/rag/types/retrieval";

export class RetrievalEvaluator {
  evaluate(input: {
    query: QueryPreprocessingResult;
    results: RankedContext[];
  }): RetrievalEvaluation {
    const warnings: string[] = [];

    if (!input.results.length) {
      return {
        groundedness: 0,
        coverage: 0,
        diversity: 0,
        risk: "high",
        warnings: ["No retrieval context was found for this query."],
      };
    }

    const averageSimilarity =
      input.results.reduce((total, result) => total + result.similarity, 0) / input.results.length;
    const queryTerms = new Set(input.query.keywords);
    const matchedTerms = new Set<string>();

    for (const result of input.results) {
      const content = result.content.toLowerCase();

      for (const term of queryTerms) {
        if (content.includes(term)) {
          matchedTerms.add(term);
        }
      }
    }

    const uniqueDocuments = new Set(input.results.map((result) => result.documentId)).size;
    const coverage = queryTerms.size ? matchedTerms.size / queryTerms.size : 1;
    const diversity = uniqueDocuments / input.results.length;
    const groundedness = Math.min(1, averageSimilarity * 0.75 + coverage * 0.25);

    if (groundedness < 0.35) {
      warnings.push("Retrieved context has low semantic grounding.");
    }

    if (coverage < 0.45) {
      warnings.push("Retrieved context covers only part of the query terms.");
    }

    if (diversity < 0.34 && input.results.length > 2) {
      warnings.push("Retrieved context is concentrated in a small number of documents.");
    }

    const risk =
      groundedness < 0.35 || coverage < 0.35 ? "high" : warnings.length ? "medium" : "low";

    return {
      groundedness,
      coverage,
      diversity,
      risk,
      warnings,
    };
  }
}

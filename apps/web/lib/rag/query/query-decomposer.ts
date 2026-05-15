import type { DecomposedQuery, QueryPreprocessingResult } from "@/lib/rag/types/retrieval";
import { QueryPreprocessor } from "@/lib/rag/preprocessing/query-preprocessor";

const decompositionSeparators = /\s+(?:and|or|vs|versus|compare|also)\s+|[;?]\s*/i;

function uniqueQueries(queries: DecomposedQuery[]) {
  const seen = new Set<string>();

  return queries.filter((query) => {
    const key = query.normalizedQuery.toLowerCase();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export class QueryDecomposer {
  constructor(private readonly preprocessor = new QueryPreprocessor()) {}

  decompose(input: {
    query: QueryPreprocessingResult;
    maxQueries: number;
    enableQueryDecomposition?: boolean;
    enableMultiQuery?: boolean;
  }): DecomposedQuery[] {
    const queries: DecomposedQuery[] = [
      {
        ...input.query,
        id: "q0",
        parentQuery: input.query.normalizedQuery,
        strategy: "original",
      },
    ];

    if (input.enableQueryDecomposition !== false) {
      const parts = input.query.normalizedQuery
        .split(decompositionSeparators)
        .map((part) => part.trim())
        .filter((part) => part.length > 12 && part !== input.query.normalizedQuery);

      for (const part of parts) {
        const query = this.preprocessor.preprocess(part);
        queries.push({
          ...query,
          id: `q${queries.length}`,
          parentQuery: input.query.normalizedQuery,
          strategy: "decomposed",
        });
      }
    }

    if (input.enableMultiQuery !== false && input.query.keywords.length >= 3) {
      const keywordQuery = input.query.keywords.slice(0, 8).join(" ");
      const preprocessed = this.preprocessor.preprocess(keywordQuery);

      queries.push({
        ...preprocessed,
        id: `q${queries.length}`,
        parentQuery: input.query.normalizedQuery,
        strategy: "keyword",
      });
    }

    return uniqueQueries(queries).slice(0, input.maxQueries);
  }
}

import type { VectorSearchResult } from "@/lib/db/types/rag";

function shingles(content: string) {
  const tokens = content
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 240);
  const values = new Set<string>();

  for (let index = 0; index < tokens.length - 2; index += 1) {
    values.add(tokens.slice(index, index + 3).join(" "));
  }

  return values;
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) {
    return 0;
  }

  let intersection = 0;

  for (const value of a) {
    if (b.has(value)) {
      intersection += 1;
    }
  }

  return intersection / (a.size + b.size - intersection);
}

export class ContextDeduplicator {
  dedupe<T extends VectorSearchResult>(
    results: T[],
    options?: { threshold?: number; limit?: number },
  ) {
    const threshold = options?.threshold ?? 0.82;
    const selected: Array<{ result: T; shingles: Set<string> }> = [];

    for (const result of results) {
      const currentShingles = shingles(result.content);
      const duplicate = selected.some(
        (item) =>
          item.result.documentId === result.documentId &&
          jaccard(item.shingles, currentShingles) >= threshold,
      );

      if (!duplicate) {
        selected.push({ result, shingles: currentShingles });
      }

      if (options?.limit && selected.length >= options.limit) {
        break;
      }
    }

    return selected.map((item) => item.result);
  }
}

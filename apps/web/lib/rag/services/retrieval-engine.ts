import { EmbeddingRepository } from "@/lib/db/repositories/embedding-repository";
import { RetrievalLogRepository } from "@/lib/db/repositories/retrieval-log-repository";
import { prisma } from "@/lib/prisma";
import { createEmbeddingProvider } from "@/lib/embeddings/providers/provider-factory";
import type { EmbeddingProvider } from "@/lib/embeddings/types/embedding";
import { env } from "@/lib/env";
import { createLangSmithTrace } from "@/lib/observability/langsmith";
import { telemetry } from "@/lib/observability/telemetry";
import { RetrievalEvaluator } from "@/lib/rag/evaluation/retrieval-evaluator";
import { ContextDeduplicator } from "@/lib/rag/pipeline/context-deduplicator";
import { HybridRetrievalStage } from "@/lib/rag/pipeline/hybrid-retrieval-stage";
import { ReciprocalRankFusion } from "@/lib/rag/pipeline/reciprocal-rank-fusion";
import type { RetrievalStage } from "@/lib/rag/pipeline/retrieval-stage";
import { QueryDecomposer } from "@/lib/rag/query/query-decomposer";
import { QueryPreprocessor } from "@/lib/rag/preprocessing/query-preprocessor";
import type { RetrievalContext, RetrievalRequest } from "@/lib/rag/types/retrieval";
import { WeightedReranker } from "@/lib/rag/rerankers/weighted-reranker";
import type { Reranker } from "@/lib/rag/rerankers/reranker";
import { ContextBuilder } from "@/lib/rag/services/context-builder";
import { cacheKey, getOrSetCache } from "@/lib/performance/cache";

export class RetrievalEngine {
  private readonly stages: RetrievalStage[];

  constructor(
    private readonly provider: EmbeddingProvider = createEmbeddingProvider(),
    private readonly embeddings = new EmbeddingRepository(prisma),
    private readonly logs = new RetrievalLogRepository(prisma),
    private readonly preprocessor = new QueryPreprocessor(),
    private readonly reranker: Reranker = new WeightedReranker(),
    private readonly contextBuilder = new ContextBuilder(),
    private readonly decomposer = new QueryDecomposer(preprocessor),
    private readonly fusion = new ReciprocalRankFusion(),
    private readonly deduplicator = new ContextDeduplicator(),
    private readonly evaluator = new RetrievalEvaluator(),
    stages?: RetrievalStage[],
  ) {
    this.stages = stages ?? [new HybridRetrievalStage(this.embeddings)];
  }

  async retrieve(input: RetrievalRequest): Promise<RetrievalContext> {
    const retrievalCacheKey = cacheKey([
      "retrieval",
      input.organizationId,
      input.query.trim().toLowerCase(),
      input.mode ?? "hybrid",
      input.limit ?? env.RAG_RETRIEVAL_LIMIT,
      input.minSimilarity ?? env.RAG_MIN_SIMILARITY,
      JSON.stringify(input.metadataFilter ?? {}),
      Boolean(input.enableQueryDecomposition),
      Boolean(input.enableMultiQuery),
    ]);

    if (env.RAG_RETRIEVAL_CACHE_SECONDS > 0) {
      return getOrSetCache(retrievalCacheKey, env.RAG_RETRIEVAL_CACHE_SECONDS, () =>
        this.retrieveUncached(input),
      );
    }

    return this.retrieveUncached(input);
  }

  private async retrieveUncached(input: RetrievalRequest): Promise<RetrievalContext> {
    const startedAt = Date.now();
    const query = this.preprocessor.preprocess(input.query);
    const limit = input.limit ?? env.RAG_RETRIEVAL_LIMIT;
    const minSimilarity = input.minSimilarity ?? env.RAG_MIN_SIMILARITY;
    const mode = input.mode ?? "hybrid";
    const candidateLimit = limit * env.RAG_CANDIDATE_MULTIPLIER;
    const queries = this.decomposer.decompose({
      query,
      maxQueries: env.RAG_MULTI_QUERY_LIMIT,
      enableQueryDecomposition: input.enableQueryDecomposition,
      enableMultiQuery: input.enableMultiQuery,
    });
    const vectors = await this.provider.embedDocuments(queries.map((item) => item.normalizedQuery));

    if (vectors.length !== queries.length || vectors.some((vector) => !vector.length)) {
      throw new Error("Embedding provider did not return vectors for all retrieval queries.");
    }

    const stageResults = await Promise.all(
      queries.flatMap((decomposedQuery, queryIndex) =>
        this.stages.map((stage) =>
          stage.retrieve({
            organizationId: input.organizationId,
            query: decomposedQuery,
            vector: vectors[queryIndex] ?? [],
            provider: this.provider.name,
            model: this.provider.model,
            mode,
            limit: candidateLimit,
            minSimilarity,
            metadataFilter: input.metadataFilter,
          }),
        ),
      ),
    );

    const fused = this.fusion.fuse(stageResults, { limit: candidateLimit * 2 });
    const deduped = this.deduplicator.dedupe(fused, {
      limit: candidateLimit,
      threshold: 0.82,
    });
    const ranked = await this.reranker.rerank({
      query,
      results: deduped,
      limit,
      diversityBoost: 0.03,
    });
    const evaluation = this.evaluator.evaluate({ query, results: ranked });
    const { contextText, citations } = this.contextBuilder.build(ranked);
    const latencyMs = Date.now() - startedAt;

    await telemetry.captureEvent({
      organizationId: input.organizationId,
      category: "retrieval",
      name: "retrieval.completed",
      provider: this.provider.name,
      model: this.provider.model,
      latencyMs,
      metadata: {
        mode,
        queryCount: queries.length,
        candidateCount: fused.length,
        dedupedCount: deduped.length,
        resultCount: ranked.length,
        evaluation,
      },
    });
    await createLangSmithTrace({
      id: crypto.randomUUID(),
      name: "retrieval.advanced",
      runType: "retriever",
      inputs: { query: query.normalizedQuery, organizationId: input.organizationId },
      outputs: { resultCount: ranked.length, evaluation },
      metadata: { mode, queryCount: queries.length, latencyMs },
    });

    await Promise.all(
      ranked.map((result, index) =>
        this.logs.createRetrievalLog({
          organizationId: input.organizationId,
          conversationId: input.conversationId,
          query: query.normalizedQuery,
          documentId: result.documentId,
          chunkId: result.chunkId,
          embeddingId: result.embeddingId,
          provider: this.provider.name,
          model: this.provider.model,
          similarity: result.similarity,
          rank: index + 1,
          latencyMs,
          metadata: {
            mode,
            pipeline: "advanced-hybrid-multi-query",
            queryCount: queries.length,
            stageCount: this.stages.length,
            candidateCount: fused.length,
            dedupedCount: deduped.length,
            rerankScore: result.rerankScore,
            fusedScore: result.fusedScore ?? result.rankScore,
            citationId: result.citationId,
            textRank: result.textRank,
            vectorRank: result.vectorRank,
            keywordRank: result.keywordRank,
            sourceQueries: result.sourceQueries,
            retrievalStrategies: result.retrievalStrategies,
            evaluation,
          },
        }),
      ),
    );

    return {
      query,
      queries,
      results: ranked,
      contextText,
      citations,
      evaluation,
    };
  }
}

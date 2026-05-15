import { Prisma } from "@prisma/client";

import type { DbClient } from "@/lib/db/types/prisma";
import type {
  TenantScope,
  UpsertEmbeddingInput,
  VectorSearchInput,
  VectorSearchResult,
} from "@/lib/db/types/rag";

function vectorLiteral(vector: number[]) {
  return `[${vector.join(",")}]`;
}

function jsonLiteral(value: unknown) {
  return JSON.stringify(value ?? {});
}

function metadataFilterSql(filter: unknown) {
  return filter ? Prisma.sql`AND c.metadata @> ${jsonLiteral(filter)}::jsonb` : Prisma.empty;
}

export class EmbeddingRepository {
  constructor(private readonly db: DbClient) {}

  async upsertEmbedding(input: UpsertEmbeddingInput) {
    const [embedding] = await this.db.$queryRaw<Array<{ id: string }>>`
      INSERT INTO embeddings (
        id,
        organization_id,
        chunk_id,
        provider,
        model,
        dimensions,
        vector,
        metadata,
        created_at,
        updated_at
      )
      VALUES (
        gen_random_uuid()::text,
        ${input.organizationId},
        ${input.chunkId},
        ${input.provider},
        ${input.model},
        ${input.dimensions},
        ${vectorLiteral(input.vector)}::vector,
        ${jsonLiteral(input.metadata)}::jsonb,
        now(),
        now()
      )
      ON CONFLICT (chunk_id, provider, model)
      DO UPDATE SET
        dimensions = EXCLUDED.dimensions,
        vector = EXCLUDED.vector,
        metadata = EXCLUDED.metadata,
        deleted_at = NULL,
        updated_at = now()
      RETURNING id
    `;

    if (!embedding) {
      throw new Error("Embedding upsert did not return an id.");
    }

    return this.db.embedding.findUniqueOrThrow({ where: { id: embedding.id } });
  }

  similaritySearch(input: VectorSearchInput) {
    const limit = input.limit ?? 8;
    const minSimilarity = input.minSimilarity ?? 0;
    const providerFilter = input.provider
      ? Prisma.sql`AND e.provider = ${input.provider}`
      : Prisma.empty;
    const modelFilter = input.model ? Prisma.sql`AND e.model = ${input.model}` : Prisma.empty;
    const metadataFilter = metadataFilterSql(input.metadataFilter);

    return this.db.$queryRaw<VectorSearchResult[]>`
      SELECT
        e.id AS "embeddingId",
        c.id AS "chunkId",
        d.id AS "documentId",
        d.title AS "documentTitle",
        d.source_uri AS "sourceUri",
        c.content,
        1 - (e.vector <=> ${vectorLiteral(input.vector)}::vector) AS similarity,
        c.metadata,
        d.metadata AS "documentMetadata",
        'semantic' AS "retrievalStrategy"
      FROM embeddings e
      INNER JOIN document_chunks c ON c.id = e.chunk_id
      INNER JOIN documents d ON d.id = c.document_id
      WHERE e.organization_id = ${input.organizationId}
        AND c.organization_id = ${input.organizationId}
        AND d.organization_id = ${input.organizationId}
        AND e.deleted_at IS NULL
        AND c.deleted_at IS NULL
        AND d.deleted_at IS NULL
        ${providerFilter}
        ${modelFilter}
        ${metadataFilter}
        AND 1 - (e.vector <=> ${vectorLiteral(input.vector)}::vector) >= ${minSimilarity}
      ORDER BY e.vector <=> ${vectorLiteral(input.vector)}::vector
      LIMIT ${limit}
    `;
  }

  keywordSearch(input: VectorSearchInput & { query: string }) {
    const limit = input.limit ?? 8;
    const providerFilter = input.provider
      ? Prisma.sql`AND e.provider = ${input.provider}`
      : Prisma.empty;
    const modelFilter = input.model ? Prisma.sql`AND e.model = ${input.model}` : Prisma.empty;
    const metadataFilter = metadataFilterSql(input.metadataFilter);

    return this.db.$queryRaw<VectorSearchResult[]>`
      SELECT
        e.id AS "embeddingId",
        c.id AS "chunkId",
        d.id AS "documentId",
        d.title AS "documentTitle",
        d.source_uri AS "sourceUri",
        c.content,
        1 - (e.vector <=> ${vectorLiteral(input.vector)}::vector) AS similarity,
        c.metadata,
        d.metadata AS "documentMetadata",
        ts_rank_cd(
          to_tsvector('english', coalesce(d.title, '') || ' ' || c.content),
          websearch_to_tsquery('english', ${input.query})
        ) AS "textRank",
        ts_rank_cd(
          to_tsvector('english', coalesce(d.title, '') || ' ' || c.content),
          websearch_to_tsquery('english', ${input.query})
        ) AS "rankScore",
        'bm25' AS "retrievalStrategy"
      FROM embeddings e
      INNER JOIN document_chunks c ON c.id = e.chunk_id
      INNER JOIN documents d ON d.id = c.document_id
      WHERE e.organization_id = ${input.organizationId}
        AND c.organization_id = ${input.organizationId}
        AND d.organization_id = ${input.organizationId}
        AND e.deleted_at IS NULL
        AND c.deleted_at IS NULL
        AND d.deleted_at IS NULL
        ${providerFilter}
        ${modelFilter}
        ${metadataFilter}
        AND websearch_to_tsquery('english', ${input.query}) @@
          to_tsvector('english', coalesce(d.title, '') || ' ' || c.content)
      ORDER BY "rankScore" DESC
      LIMIT ${limit}
    `;
  }

  hybridSearch(
    input: VectorSearchInput & { query: string; semanticWeight?: number; keywordWeight?: number },
  ) {
    const limit = input.limit ?? 8;
    const minSimilarity = input.minSimilarity ?? 0;
    const semanticWeight = input.semanticWeight ?? 0.72;
    const keywordWeight = input.keywordWeight ?? 0.28;
    const providerFilter = input.provider
      ? Prisma.sql`AND e.provider = ${input.provider}`
      : Prisma.empty;
    const modelFilter = input.model ? Prisma.sql`AND e.model = ${input.model}` : Prisma.empty;
    const metadataFilter = metadataFilterSql(input.metadataFilter);

    return this.db.$queryRaw<VectorSearchResult[]>`
      WITH scored AS (
        SELECT
          e.id AS "embeddingId",
          c.id AS "chunkId",
          d.id AS "documentId",
          d.title AS "documentTitle",
          d.source_uri AS "sourceUri",
          c.content,
          c.metadata,
          d.metadata AS "documentMetadata",
          1 - (e.vector <=> ${vectorLiteral(input.vector)}::vector) AS similarity,
          ts_rank_cd(
            to_tsvector('english', coalesce(d.title, '') || ' ' || c.content),
            plainto_tsquery('english', ${input.query})
          ) AS "textRank"
        FROM embeddings e
        INNER JOIN document_chunks c ON c.id = e.chunk_id
        INNER JOIN documents d ON d.id = c.document_id
        WHERE e.organization_id = ${input.organizationId}
          AND c.organization_id = ${input.organizationId}
          AND d.organization_id = ${input.organizationId}
          AND e.deleted_at IS NULL
          AND c.deleted_at IS NULL
          AND d.deleted_at IS NULL
          ${providerFilter}
          ${modelFilter}
          ${metadataFilter}
      )
      SELECT
        "embeddingId",
        "chunkId",
        "documentId",
        "documentTitle",
        "sourceUri",
        content,
        metadata,
        "documentMetadata",
        similarity,
        "textRank",
        (${semanticWeight} * similarity) + (${keywordWeight} * "textRank") AS "rankScore",
        'hybrid' AS "retrievalStrategy"
      FROM scored
      WHERE similarity >= ${minSimilarity} OR "textRank" > 0
      ORDER BY "rankScore" DESC, similarity DESC
      LIMIT ${limit}
    `;
  }

  softDeleteByDocument(scope: TenantScope, documentId: string) {
    return this.db.$executeRaw`
      UPDATE embeddings e
      SET deleted_at = now(), updated_at = now()
      FROM document_chunks c
      WHERE e.chunk_id = c.id
        AND e.organization_id = ${scope.organizationId}
        AND c.organization_id = ${scope.organizationId}
        AND c.document_id = ${documentId}
        AND e.deleted_at IS NULL
    `;
  }
}

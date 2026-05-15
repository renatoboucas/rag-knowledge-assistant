import { Prisma, type MemoryType } from "@prisma/client";

import type { DbClient } from "@/lib/db/types/prisma";
import type {
  CreateConversationSummaryInput,
  CreateMemoryItemInput,
  MemorySearchInput,
  MemorySearchResult,
  TenantScope,
} from "@/lib/db/types/rag";

function vectorLiteral(vector: number[]) {
  return `[${vector.join(",")}]`;
}

function jsonLiteral(value: unknown) {
  return JSON.stringify(value ?? {});
}

function memoryTypeFilter(types?: MemoryType[]) {
  if (!types?.length) {
    return Prisma.empty;
  }

  return Prisma.sql`AND mi.type IN (${Prisma.join(
    types.map((type) => Prisma.sql`${type}::"MemoryType"`),
  )})`;
}

export class MemoryRepository {
  constructor(private readonly db: DbClient) {}

  createConversationSummary(input: CreateConversationSummaryInput) {
    return this.db.conversationSummary.create({
      data: {
        organizationId: input.organizationId,
        conversationId: input.conversationId,
        summary: input.summary,
        messageCount: input.messageCount,
        coveredMessageIds: input.coveredMessageIds,
        inputTokenCount: input.inputTokenCount,
        summaryTokenCount: input.summaryTokenCount,
        compressionRatio: input.compressionRatio,
        metadata: input.metadata ?? {},
      },
    });
  }

  getLatestConversationSummary(scope: TenantScope, conversationId: string) {
    return this.db.conversationSummary.findFirst({
      where: {
        organizationId: scope.organizationId,
        conversationId,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  listRecentMessages(
    scope: TenantScope,
    conversationId: string,
    options?: { take?: number; before?: Date },
  ) {
    return this.db.message.findMany({
      where: {
        organizationId: scope.organizationId,
        conversationId,
        deletedAt: null,
        ...(options?.before ? { createdAt: { lt: options.before } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: options?.take ?? 12,
    });
  }

  async createMemoryItem(input: CreateMemoryItemInput) {
    const [memory] = await this.db.$queryRaw<Array<{ id: string }>>`
      INSERT INTO memory_items (
        id,
        organization_id,
        conversation_id,
        source_message_id,
        type,
        status,
        content,
        summary,
        importance,
        token_count,
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
        ${input.conversationId ?? null},
        ${input.sourceMessageId ?? null},
        ${(input.type ?? "LONG_TERM") as MemoryType}::"MemoryType",
        ${input.status ?? "ACTIVE"}::"MemoryStatus",
        ${input.content},
        ${input.summary ?? null},
        ${input.importance ?? 0.5},
        ${input.tokenCount ?? 0},
        ${input.provider ?? null},
        ${input.model ?? null},
        ${input.dimensions ?? null},
        ${input.vector?.length ? Prisma.sql`${vectorLiteral(input.vector)}::vector` : Prisma.sql`NULL`},
        ${jsonLiteral(input.metadata)}::jsonb,
        now(),
        now()
      )
      RETURNING id
    `;

    if (!memory) {
      throw new Error("Memory insert did not return an id.");
    }

    return this.db.memoryItem.findUniqueOrThrow({ where: { id: memory.id } });
  }

  searchSemanticMemory(input: MemorySearchInput) {
    const limit = input.limit ?? 6;
    const minSimilarity = input.minSimilarity ?? 0.15;
    const typeFilter = memoryTypeFilter(input.types);
    const conversationFilter = input.conversationId
      ? Prisma.sql`AND (mi.conversation_id = ${input.conversationId} OR mi.conversation_id IS NULL)`
      : Prisma.empty;

    return this.db.$queryRaw<MemorySearchResult[]>`
      SELECT
        mi.id,
        mi.conversation_id AS "conversationId",
        mi.source_message_id AS "sourceMessageId",
        mi.type,
        mi.content,
        mi.summary,
        mi.importance,
        mi.token_count AS "tokenCount",
        mi.metadata,
        1 - (mi.vector <=> ${vectorLiteral(input.vector)}::vector) AS similarity,
        (
          (0.72 * (1 - (mi.vector <=> ${vectorLiteral(input.vector)}::vector))) +
          (0.2 * mi.importance) +
          (0.08 * LEAST(mi.access_count, 10) / 10.0)
        ) AS "rankScore",
        mi.created_at AS "createdAt"
      FROM memory_items mi
      WHERE mi.organization_id = ${input.organizationId}
        AND mi.deleted_at IS NULL
        AND mi.status = 'ACTIVE'
        AND mi.vector IS NOT NULL
        ${conversationFilter}
        ${typeFilter}
        AND 1 - (mi.vector <=> ${vectorLiteral(input.vector)}::vector) >= ${minSimilarity}
      ORDER BY "rankScore" DESC, similarity DESC
      LIMIT ${limit}
    `;
  }

  markAccessed(scope: TenantScope, memoryIds: string[]) {
    if (!memoryIds.length) {
      return Promise.resolve({ count: 0 });
    }

    return this.db.memoryItem.updateMany({
      where: {
        organizationId: scope.organizationId,
        id: { in: memoryIds },
        deletedAt: null,
      },
      data: {
        accessCount: { increment: 1 },
        lastAccessedAt: new Date(),
      },
    });
  }
}

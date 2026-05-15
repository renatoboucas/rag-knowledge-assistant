import type { DbClient } from "@/lib/db/types/prisma";
import type { CreatePromptInput, TenantScope } from "@/lib/db/types/rag";

export class PromptRepository {
  constructor(private readonly db: DbClient) {}

  createPrompt(input: CreatePromptInput) {
    return this.db.prompt.create({
      data: {
        organizationId: input.organizationId,
        createdById: input.createdById,
        name: input.name,
        key: input.key,
        version: input.version ?? 1,
        status: input.status ?? "DRAFT",
        template: input.template,
        metadata: input.metadata ?? {},
      },
    });
  }

  getActivePrompt(scope: TenantScope, key: string) {
    return this.db.prompt.findFirst({
      where: {
        organizationId: scope.organizationId,
        key,
        status: "ACTIVE",
        deletedAt: null,
      },
      orderBy: { version: "desc" },
    });
  }

  listPrompts(scope: TenantScope) {
    return this.db.prompt.findMany({
      where: { organizationId: scope.organizationId, deletedAt: null },
      orderBy: [{ key: "asc" }, { version: "desc" }],
    });
  }

  softDeletePrompt(scope: TenantScope, promptId: string) {
    return this.db.prompt.update({
      where: { id: promptId, organizationId: scope.organizationId },
      data: {
        deletedAt: new Date(),
        status: "ARCHIVED",
      },
    });
  }
}

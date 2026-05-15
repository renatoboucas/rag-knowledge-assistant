import { prisma } from "@/lib/prisma";
import { PromptRepository } from "@/lib/db/repositories/prompt-repository";
import type { CreatePromptInput, TenantScope } from "@/lib/db/types/rag";

export class PromptService {
  constructor(private readonly prompts = new PromptRepository(prisma)) {}

  createPrompt(input: CreatePromptInput) {
    return this.prompts.createPrompt(input);
  }

  getActivePrompt(scope: TenantScope, key: string) {
    return this.prompts.getActivePrompt(scope, key);
  }

  listPrompts(scope: TenantScope) {
    return this.prompts.listPrompts(scope);
  }
}

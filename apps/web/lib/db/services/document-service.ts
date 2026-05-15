import { prisma } from "@/lib/prisma";
import { DocumentRepository } from "@/lib/db/repositories/document-repository";
import { EmbeddingRepository } from "@/lib/db/repositories/embedding-repository";
import type { CreateChunkInput, CreateDocumentInput, TenantScope } from "@/lib/db/types/rag";
import { withTransaction } from "@/lib/db/transaction";

export class DocumentService {
  constructor(private readonly documents = new DocumentRepository(prisma)) {}

  createDocument(input: CreateDocumentInput) {
    return this.documents.createDocument(input);
  }

  ingestDocument(
    input: CreateDocumentInput,
    chunks: Omit<CreateChunkInput, "organizationId" | "documentId">[],
  ) {
    return withTransaction(async (tx) => {
      const documents = new DocumentRepository(tx);
      const document = await documents.createDocument(input);
      const scopedChunks = chunks.map((chunk) => ({
        ...chunk,
        organizationId: input.organizationId,
        documentId: document.id,
      }));

      await documents.createChunks(scopedChunks);

      return documents.updateDocumentStats({ organizationId: input.organizationId }, document.id, {
        chunkCount: scopedChunks.length,
        tokenCount: scopedChunks.reduce((total, chunk) => total + (chunk.tokenCount ?? 0), 0),
      });
    });
  }

  async softDeleteDocument(scope: TenantScope, documentId: string) {
    return withTransaction(async (tx) => {
      const embeddings = new EmbeddingRepository(tx);
      const documents = new DocumentRepository(tx);

      await embeddings.softDeleteByDocument(scope, documentId);
      return documents.softDeleteDocument(scope, documentId);
    });
  }
}

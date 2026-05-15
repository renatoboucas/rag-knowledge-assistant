import { prisma } from "@/lib/prisma";
import { DocumentRepository } from "@/lib/db/repositories/document-repository";
import { recursiveChunkingService } from "@/lib/embeddings/services/chunking-service";
import { embeddingQueue } from "@/lib/embeddings/queue/embedding-queue";
import { localStorageProvider } from "@/lib/uploads/storage/local-storage-provider";
import type { UploadQueueItem } from "@/lib/uploads/types/upload";
import { getParserForFilename } from "@/lib/uploads/parsers/parser-registry";
import { withTransaction } from "@/lib/db/transaction";

export class UploadProcessingService {
  async process(item: UploadQueueItem) {
    const scope = { organizationId: item.organizationId };
    const documents = new DocumentRepository(prisma);

    await documents.updateDocumentProcessingState(scope, item.documentId, {
      status: "PROCESSING",
      errorMessage: null,
      metadata: {
        upload: {
          filename: item.filename,
          storageKey: item.storageKey,
          size: item.size,
          checksum: item.checksum,
          phase: "parsing",
          progress: 25,
        },
      },
    });

    try {
      const parser = getParserForFilename(item.filename);
      const buffer = await localStorageProvider.get(item.storageKey);
      const parsed = await parser.parse({
        buffer,
        filename: item.filename,
        mimeType: item.mimeType,
      });

      if (!parsed.text) {
        throw new Error("No extractable text found in document.");
      }

      const chunks = await recursiveChunkingService.chunk({
        organizationId: item.organizationId,
        documentId: item.documentId,
        text: parsed.text,
        metadata: {
          parser: parsed.metadata,
          upload: {
            filename: item.filename,
            storageKey: item.storageKey,
            size: item.size,
            checksum: item.checksum,
          },
        },
      });

      if (!chunks.length) {
        throw new Error("Document did not produce any chunks.");
      }

      await withTransaction(async (tx) => {
        const txDocuments = new DocumentRepository(tx);

        await txDocuments.deleteChunksForDocument(scope, item.documentId);
        await txDocuments.createChunks(chunks);
        await txDocuments.updateDocumentStats(scope, item.documentId, {
          chunkCount: chunks.length,
          tokenCount: chunks.reduce((total, chunk) => total + (chunk.tokenCount ?? 0), 0),
        });
        await txDocuments.updateDocumentProcessingState(scope, item.documentId, {
          status: "PROCESSING",
          errorMessage: null,
          metadata: {
            parser: parsed.metadata,
            upload: {
              filename: item.filename,
              storageKey: item.storageKey,
              size: item.size,
              checksum: item.checksum,
              phase: "embedding",
              progress: 75,
            },
          },
        });
      });

      embeddingQueue.enqueue({
        organizationId: item.organizationId,
        documentId: item.documentId,
      });
    } catch (error) {
      await documents.updateDocumentProcessingState(scope, item.documentId, {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Unknown upload processing error.",
        metadata: {
          upload: {
            filename: item.filename,
            storageKey: item.storageKey,
            size: item.size,
            checksum: item.checksum,
            phase: "failed",
            progress: 100,
          },
        },
      });
    }
  }
}

export const uploadProcessingService = new UploadProcessingService();

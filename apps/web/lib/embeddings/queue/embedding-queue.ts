import type { EmbedDocumentJob } from "@/lib/embeddings/types/embedding";
import { EmbeddingService } from "@/lib/embeddings/services/embedding-service";

type EmbeddingJobState = "queued" | "processing" | "complete" | "failed";

type InternalEmbeddingJob = EmbedDocumentJob & {
  id: string;
  attempts: number;
  state: EmbeddingJobState;
  error?: string;
  queuedAt: Date;
};

class EmbeddingQueue {
  private readonly queue: InternalEmbeddingJob[] = [];
  private processing = false;

  enqueue(job: EmbedDocumentJob) {
    this.queue.push({
      ...job,
      id: crypto.randomUUID(),
      attempts: 0,
      state: "queued",
      queuedAt: new Date(),
    });

    void this.drain();
  }

  snapshot() {
    return this.queue.map((job) => ({
      id: job.id,
      organizationId: job.organizationId,
      documentId: job.documentId,
      attempts: job.attempts,
      state: job.state,
      error: job.error,
      queuedAt: job.queuedAt,
    }));
  }

  private async drain() {
    if (this.processing) {
      return;
    }

    this.processing = true;

    try {
      while (this.queue.some((job) => job.state === "queued")) {
        const job = this.queue.find((candidate) => candidate.state === "queued");

        if (!job) {
          break;
        }

        job.state = "processing";
        job.attempts += 1;

        try {
          await new EmbeddingService().embedDocument(job);
          job.state = "complete";
        } catch (error) {
          job.state = "failed";
          job.error = error instanceof Error ? error.message : "Unknown embedding error.";
        }
      }
    } finally {
      this.processing = false;
    }
  }
}

const globalForEmbeddingQueue = globalThis as unknown as {
  embeddingQueue?: EmbeddingQueue;
};

export const embeddingQueue = globalForEmbeddingQueue.embeddingQueue ?? new EmbeddingQueue();

if (process.env.NODE_ENV !== "production") {
  globalForEmbeddingQueue.embeddingQueue = embeddingQueue;
}

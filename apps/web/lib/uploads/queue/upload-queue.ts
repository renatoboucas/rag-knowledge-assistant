import type { UploadQueueItem } from "@/lib/uploads/types/upload";
import { uploadProcessingService } from "@/lib/uploads/services/upload-processing-service";

type QueueState = "queued" | "processing" | "complete" | "failed";

type InternalQueueItem = UploadQueueItem & {
  queuedAt: Date;
  attempts: number;
  state: QueueState;
};

class UploadQueue {
  private readonly queue: InternalQueueItem[] = [];
  private processing = false;

  enqueue(item: UploadQueueItem) {
    this.queue.push({
      ...item,
      queuedAt: new Date(),
      attempts: 0,
      state: "queued",
    });

    void this.drain();
  }

  snapshot() {
    return this.queue.map((item) => ({
      documentId: item.documentId,
      filename: item.filename,
      attempts: item.attempts,
      state: item.state,
      queuedAt: item.queuedAt,
    }));
  }

  private async drain() {
    if (this.processing) {
      return;
    }

    this.processing = true;

    try {
      while (this.queue.some((item) => item.state === "queued")) {
        const item = this.queue.find((candidate) => candidate.state === "queued");

        if (!item) {
          break;
        }

        item.state = "processing";
        item.attempts += 1;

        try {
          await uploadProcessingService.process(item);
          item.state = "complete";
        } catch {
          item.state = "failed";
        }
      }
    } finally {
      this.processing = false;
    }
  }
}

const globalForUploadQueue = globalThis as unknown as {
  uploadQueue?: UploadQueue;
};

export const uploadQueue = globalForUploadQueue.uploadQueue ?? new UploadQueue();

if (process.env.NODE_ENV !== "production") {
  globalForUploadQueue.uploadQueue = uploadQueue;
}

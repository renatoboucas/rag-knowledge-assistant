import { connectorService } from "@/lib/connectors/services/connector-service";

type QueueState = "queued" | "processing" | "complete" | "failed";

type ConnectorQueueItem = {
  jobId: string;
  connectorId: string;
  organizationId: string;
  queuedAt: Date;
  attempts: number;
  state: QueueState;
};

class ConnectorSyncQueue {
  private readonly queue: ConnectorQueueItem[] = [];
  private processing = false;

  enqueue(item: Omit<ConnectorQueueItem, "queuedAt" | "attempts" | "state">) {
    this.queue.push({ ...item, queuedAt: new Date(), attempts: 0, state: "queued" });
    void this.drain();
  }

  snapshot(organizationId?: string) {
    return this.queue
      .filter((item) => !organizationId || item.organizationId === organizationId)
      .map((item) => ({ ...item }));
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
          await connectorService.runSyncJob(item.jobId);
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

const globalForConnectorSyncQueue = globalThis as unknown as {
  connectorSyncQueue?: ConnectorSyncQueue;
};

export const connectorSyncQueue =
  globalForConnectorSyncQueue.connectorSyncQueue ?? new ConnectorSyncQueue();

if (process.env.NODE_ENV !== "production") {
  globalForConnectorSyncQueue.connectorSyncQueue = connectorSyncQueue;
}

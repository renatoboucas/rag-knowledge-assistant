import { workflowService } from "@/lib/workflows/services/workflow-service";

type QueueState = "queued" | "processing" | "complete" | "failed";

type WorkflowQueueItem = {
  runId: string;
  workflowId: string;
  organizationId: string;
  queuedAt: Date;
  attempts: number;
  state: QueueState;
};

class WorkflowQueue {
  private readonly queue: WorkflowQueueItem[] = [];
  private processing = false;

  enqueue(item: Omit<WorkflowQueueItem, "queuedAt" | "attempts" | "state">) {
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
          await workflowService.runWorkflow(item.runId);
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

const globalForWorkflowQueue = globalThis as unknown as {
  workflowQueue?: WorkflowQueue;
};

export const workflowQueue = globalForWorkflowQueue.workflowQueue ?? new WorkflowQueue();

if (process.env.NODE_ENV !== "production") {
  globalForWorkflowQueue.workflowQueue = workflowQueue;
}

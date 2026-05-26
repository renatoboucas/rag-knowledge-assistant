import type { PresenceState, RealtimeActor } from "@rag/types";

export class PresenceStore {
  private readonly state = new Map<string, PresenceState>();

  upsert(input: RealtimeActor & { socketId: string; status?: PresenceState["status"] }) {
    const presence: PresenceState = {
      ...input,
      status: input.status ?? "online",
      lastSeenAt: new Date().toISOString(),
    };

    this.state.set(input.socketId, presence);
    return presence;
  }

  remove(socketId: string) {
    const presence = this.state.get(socketId);
    this.state.delete(socketId);
    return presence;
  }

  listByOrganization(organizationId: string) {
    return Array.from(this.state.values()).filter(
      (presence) => presence.organizationId === organizationId,
    );
  }

  pruneOlderThan(cutoffMs: number) {
    const cutoff = Date.now() - cutoffMs;

    for (const [socketId, presence] of this.state.entries()) {
      if (new Date(presence.lastSeenAt).getTime() < cutoff) {
        this.state.delete(socketId);
      }
    }
  }
}

export const presenceStore = new PresenceStore();

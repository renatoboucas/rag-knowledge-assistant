import { describe, expect, it } from "vitest";

import { organizationChannel } from "@/lib/realtime/channels";
import { createRealtimeEvent, InMemoryRealtimeEventBus } from "@/lib/realtime/event-bus";

describe("realtime event bus", () => {
  it("publishes typed events to channel subscribers", async () => {
    const bus = new InMemoryRealtimeEventBus();
    const channel = organizationChannel("org_123");
    const received: string[] = [];
    const unsubscribe = await bus.subscribe(channel, (event) => {
      received.push(event.type);
    });

    await bus.publish(
      createRealtimeEvent({
        type: "presence.joined",
        channel,
        actor: { userId: "user_123", organizationId: "org_123" },
        payload: { socketId: "socket_123" },
      }),
    );
    await unsubscribe();
    await bus.close();

    expect(received).toEqual(["presence.joined"]);
  });
});

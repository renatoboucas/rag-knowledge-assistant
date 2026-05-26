import type { Server as HttpServer } from "node:http";

import type { RealtimeActor, RealtimeEvent, TypingState } from "@rag/types";
import { Server, type Socket } from "socket.io";

import { env } from "@/lib/env";
import { organizationChannel, conversationChannel } from "@/lib/realtime/channels";
import { createRealtimeEvent, getRealtimeEventBus } from "@/lib/realtime/event-bus";
import { presenceStore } from "@/lib/realtime/presence-store";
import { configureRedisAdapter } from "@/lib/realtime/redis-adapter";

type ClientToServerEvents = {
  "conversation:join": (payload: { conversationId: string }) => void;
  "conversation:leave": (payload: { conversationId: string }) => void;
  "typing:start": (payload: { conversationId: string }) => void;
  "typing:stop": (payload: { conversationId: string }) => void;
  "session:sync": (payload: Record<string, unknown>) => void;
};

type ServerToClientEvents = {
  event: (event: RealtimeEvent) => void;
  presence: (payload: { users: ReturnType<typeof presenceStore.listByOrganization> }) => void;
  error: (payload: { message: string }) => void;
};

type SocketData = {
  actor: RealtimeActor;
};

function socketActor(
  socket: Socket<ClientToServerEvents, ServerToClientEvents, never, SocketData>,
) {
  return socket.data.actor;
}

function parseActor(socket: Socket): RealtimeActor | null {
  const actor = socket.handshake.auth?.actor;

  if (!actor || typeof actor !== "object") {
    return null;
  }

  const candidate = actor as Partial<RealtimeActor>;

  if (!candidate.userId || !candidate.organizationId) {
    return null;
  }

  return {
    userId: candidate.userId,
    organizationId: candidate.organizationId,
    name: candidate.name,
    imageUrl: candidate.imageUrl,
  };
}

export async function attachRealtimeServer(httpServer: HttpServer) {
  const io = new Server<ClientToServerEvents, ServerToClientEvents, never, SocketData>(httpServer, {
    path: "/api/realtime/socket.io",
    cors: {
      origin: env.REALTIME_CORS_ORIGIN ?? env.NEXT_PUBLIC_APP_URL,
      credentials: true,
    },
    transports: ["websocket", "polling"],
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: false,
    },
  });
  const adapter = await configureRedisAdapter(io);
  const bus = getRealtimeEventBus();

  io.use((socket, next) => {
    const actor = parseActor(socket);

    if (!actor) {
      next(new Error("Realtime authentication context is required."));
      return;
    }

    socket.data.actor = actor;
    next();
  });

  io.on("connection", (socket) => {
    const actor = socketActor(socket);
    const organizationRoom = organizationChannel(actor.organizationId);
    socket.join(organizationRoom);

    const presence = presenceStore.upsert({ ...actor, socketId: socket.id });
    const presenceEvent = createRealtimeEvent({
      type: "presence.joined",
      channel: organizationRoom,
      actor,
      payload: presence,
    });

    io.to(organizationRoom).emit("event", presenceEvent);
    io.to(organizationRoom).emit("presence", {
      users: presenceStore.listByOrganization(actor.organizationId),
    });

    socket.on("conversation:join", ({ conversationId }) => {
      socket.join(conversationChannel(conversationId));
    });

    socket.on("conversation:leave", ({ conversationId }) => {
      socket.leave(conversationChannel(conversationId));
    });

    socket.on("typing:start", ({ conversationId }) => {
      const typing: TypingState = {
        ...actor,
        conversationId,
        startedAt: new Date().toISOString(),
      };
      const event = createRealtimeEvent({
        type: "typing.started",
        channel: conversationChannel(conversationId),
        actor,
        payload: typing,
      });
      socket.to(conversationChannel(conversationId)).emit("event", event);
    });

    socket.on("typing:stop", ({ conversationId }) => {
      const event = createRealtimeEvent({
        type: "typing.stopped",
        channel: conversationChannel(conversationId),
        actor,
        payload: { conversationId },
      });
      socket.to(conversationChannel(conversationId)).emit("event", event);
    });

    socket.on("session:sync", (payload) => {
      const event = createRealtimeEvent({
        type: "session.synchronized",
        channel: organizationRoom,
        actor,
        payload,
      });
      io.to(organizationRoom).emit("event", event);
    });

    socket.on("disconnect", () => {
      const removed = presenceStore.remove(socket.id);

      if (!removed) {
        return;
      }

      const event = createRealtimeEvent({
        type: "presence.left",
        channel: organizationRoom,
        actor,
        payload: removed,
      });
      io.to(organizationRoom).emit("event", event);
      io.to(organizationRoom).emit("presence", {
        users: presenceStore.listByOrganization(actor.organizationId),
      });
    });
  });

  const pruneInterval = setInterval(() => {
    presenceStore.pruneOlderThan(env.REALTIME_PRESENCE_TTL_SECONDS * 1000);
  }, env.REALTIME_PRESENCE_TTL_SECONDS * 1000);

  return {
    io,
    adapter,
    async publish<TPayload>(event: RealtimeEvent<TPayload>) {
      await bus.publish(event);
      io.to(event.channel).emit("event", event as RealtimeEvent);
    },
    async close() {
      clearInterval(pruneInterval);
      await adapter.close?.();
      await bus.close();
      io.close();
    },
  };
}

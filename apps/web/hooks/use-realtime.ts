"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOrganization, useUser } from "@clerk/nextjs";
import type { PresenceState, RealtimeEvent, TypingState } from "@rag/types";
import { io, type Socket } from "socket.io-client";

type ConnectionStatus = "disabled" | "connecting" | "connected" | "disconnected" | "error";

type ClientToServerEvents = {
  "conversation:join": (payload: { conversationId: string }) => void;
  "conversation:leave": (payload: { conversationId: string }) => void;
  "typing:start": (payload: { conversationId: string }) => void;
  "typing:stop": (payload: { conversationId: string }) => void;
  "session:sync": (payload: Record<string, unknown>) => void;
};

type ServerToClientEvents = {
  event: (event: RealtimeEvent) => void;
  presence: (payload: { users: PresenceState[] }) => void;
  error: (payload: { message: string }) => void;
};

type RealtimeSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function useRealtimeSocket() {
  const { user } = useUser();
  const { organization } = useOrganization();
  const [status, setStatus] = useState<ConnectionStatus>("disabled");
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [presence, setPresence] = useState<PresenceState[]>([]);
  const socketRef = useRef<RealtimeSocket | null>(null);

  const realtimeUrl = process.env.NEXT_PUBLIC_REALTIME_URL;
  const actor = useMemo(() => {
    if (!user || !organization) {
      return null;
    }

    return {
      userId: user.id,
      organizationId: organization.id,
      name: user.fullName ?? user.primaryEmailAddress?.emailAddress,
      imageUrl: user.imageUrl,
    };
  }, [organization, user]);

  useEffect(() => {
    if (!realtimeUrl || !actor) {
      setStatus("disabled");
      return;
    }

    setStatus("connecting");
    const socket: RealtimeSocket = io(realtimeUrl, {
      path: "/api/realtime/socket.io",
      auth: { actor },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Number.POSITIVE_INFINITY,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on("connect", () => setStatus("connected"));
    socket.on("disconnect", () => setStatus("disconnected"));
    socket.on("connect_error", () => setStatus("error"));
    socket.on("event", (event) => {
      setEvents((current) => [event, ...current].slice(0, 100));
    });
    socket.on("presence", ({ users }) => setPresence(users));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [actor, realtimeUrl]);

  const emit = useCallback(
    <TEvent extends keyof ClientToServerEvents>(
      event: TEvent,
      ...args: Parameters<ClientToServerEvents[TEvent]>
    ) => {
      socketRef.current?.emit(event, ...args);
    },
    [],
  );

  return {
    status,
    events,
    presence,
    isConnected: status === "connected",
    emit,
  };
}

export function useConversationRealtime(conversationId?: string) {
  const realtime = useRealtimeSocket();
  const { emit, events, isConnected } = realtime;
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [typingUsers, setTypingUsers] = useState<TypingState[]>([]);

  useEffect(() => {
    if (!conversationId || !isConnected) {
      return;
    }

    emit("conversation:join", { conversationId });

    return () => {
      emit("conversation:leave", { conversationId });
    };
  }, [conversationId, emit, isConnected]);

  useEffect(() => {
    const latest = events[0];

    if (!latest) {
      return;
    }

    if (latest.type === "typing.started") {
      const typing = latest.payload as unknown as TypingState;

      if (typing.conversationId === conversationId) {
        setTypingUsers((current) => [
          typing,
          ...current.filter((item) => item.userId !== typing.userId),
        ]);
      }
    }

    if (latest.type === "typing.stopped") {
      const payload = latest.payload as { conversationId?: string };

      if (payload.conversationId === conversationId) {
        setTypingUsers((current) => current.filter((item) => item.userId !== latest.actor.userId));
      }
    }
  }, [conversationId, events]);

  const startTyping = useCallback(() => {
    if (!conversationId) {
      return;
    }

    emit("typing:start", { conversationId });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      emit("typing:stop", { conversationId });
    }, 1800);
  }, [conversationId, emit]);

  const stopTyping = useCallback(() => {
    if (!conversationId) {
      return;
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    emit("typing:stop", { conversationId });
  }, [conversationId, emit]);

  return {
    ...realtime,
    typingUsers,
    startTyping,
    stopTyping,
  };
}

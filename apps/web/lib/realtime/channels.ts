import type { RealtimeChannel } from "@rag/types";

export function organizationChannel(organizationId: string): RealtimeChannel {
  return `organization:${organizationId}`;
}

export function conversationChannel(conversationId: string): RealtimeChannel {
  return `conversation:${conversationId}`;
}

export function userChannel(userId: string): RealtimeChannel {
  return `user:${userId}`;
}

export function parseChannel(channel: RealtimeChannel) {
  const [scope, id] = channel.split(":");

  return {
    scope: scope as "organization" | "conversation" | "user",
    id,
  };
}

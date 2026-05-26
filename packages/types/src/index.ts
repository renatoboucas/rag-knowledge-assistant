export type NavItem = {
  title: string;
  href: string;
  icon?: string;
};

export type KnowledgeSource = {
  id: string;
  name: string;
  status: "indexed" | "processing" | "failed";
  documents: number;
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
};

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

export type Permission =
  | "workspace:read"
  | "workspace:update"
  | "members:read"
  | "members:invite"
  | "members:remove"
  | "knowledge:read"
  | "knowledge:write"
  | "settings:read"
  | "settings:update"
  | "billing:read"
  | "billing:manage"
  | "evaluations:read"
  | "evaluations:write"
  | "developer:read"
  | "developer:manage"
  | "security:read"
  | "security:audit"
  | "data:export"
  | "data:delete";

export type Workspace = {
  id: string;
  clerkId: string;
  name: string;
  slug?: string | null;
  role: WorkspaceRole;
};

export type RealtimeChannel =
  | `organization:${string}`
  | `conversation:${string}`
  | `user:${string}`;

export type RealtimeEventType =
  | "ai.stream.started"
  | "ai.stream.token"
  | "ai.stream.completed"
  | "ai.stream.failed"
  | "presence.joined"
  | "presence.left"
  | "presence.heartbeat"
  | "typing.started"
  | "typing.stopped"
  | "conversation.updated"
  | "session.synchronized";

export type RealtimeActor = {
  userId: string;
  organizationId: string;
  name?: string | null;
  imageUrl?: string | null;
};

export type RealtimeEvent<TPayload = Record<string, unknown>> = {
  id: string;
  type: RealtimeEventType;
  channel: RealtimeChannel;
  actor: RealtimeActor;
  payload: TPayload;
  createdAt: string;
};

export type PresenceState = RealtimeActor & {
  socketId: string;
  status: "online" | "away";
  lastSeenAt: string;
};

export type TypingState = RealtimeActor & {
  conversationId: string;
  startedAt: string;
};

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

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

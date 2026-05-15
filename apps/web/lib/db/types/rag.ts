import type {
  Conversation,
  ConversationSummary,
  Document,
  DocumentChunk,
  DocumentSourceType,
  Embedding,
  MemoryItem,
  MemoryStatus,
  MemoryType,
  Message,
  MessageRole,
  Prisma,
  Prompt,
  PromptStatus,
  RetrievalLog,
} from "@prisma/client";

export type TenantScope = {
  organizationId: string;
};

export type CreateDocumentInput = TenantScope & {
  title: string;
  createdById?: string;
  sourceType?: DocumentSourceType;
  sourceUri?: string;
  mimeType?: string;
  checksum?: string;
  status?: "PENDING" | "PROCESSING" | "INDEXED" | "FAILED" | "ARCHIVED";
  metadata?: Prisma.InputJsonValue;
};

export type CreateChunkInput = TenantScope & {
  documentId: string;
  content: string;
  contentHash: string;
  chunkIndex: number;
  tokenCount?: number;
  startChar?: number;
  endChar?: number;
  metadata?: Prisma.InputJsonValue;
};

export type UpsertEmbeddingInput = TenantScope & {
  chunkId: string;
  provider: string;
  model: string;
  dimensions: number;
  vector: number[];
  metadata?: Prisma.InputJsonValue;
};

export type VectorSearchInput = TenantScope & {
  vector: number[];
  provider?: string;
  model?: string;
  limit?: number;
  minSimilarity?: number;
  metadataFilter?: Prisma.InputJsonObject;
};

export type VectorSearchResult = {
  embeddingId: string;
  chunkId: string;
  documentId: string;
  documentTitle: string;
  sourceUri: string | null;
  content: string;
  similarity: number;
  metadata: Prisma.JsonValue;
  documentMetadata: Prisma.JsonValue;
  rankScore?: number;
  textRank?: number;
  vectorRank?: number;
  keywordRank?: number;
  retrievalStrategy?: string;
};

export type CreateConversationInput = TenantScope & {
  title: string;
  metadata?: Prisma.InputJsonValue;
};

export type CreateMessageInput = TenantScope & {
  conversationId: string;
  userId?: string;
  role: MessageRole;
  content: string;
  tokenCount?: number;
  metadata?: Prisma.InputJsonValue;
};

export type CreatePromptInput = TenantScope & {
  name: string;
  key: string;
  template: string;
  version?: number;
  status?: PromptStatus;
  createdById?: string;
  metadata?: Prisma.InputJsonValue;
};

export type CreateRetrievalLogInput = TenantScope & {
  query: string;
  conversationId?: string;
  documentId?: string;
  chunkId?: string;
  embeddingId?: string;
  provider?: string;
  model?: string;
  similarity?: number;
  rank?: number;
  latencyMs?: number;
  metadata?: Prisma.InputJsonValue;
};

export type CreateConversationSummaryInput = TenantScope & {
  conversationId: string;
  summary: string;
  messageCount: number;
  coveredMessageIds: string[];
  inputTokenCount: number;
  summaryTokenCount: number;
  compressionRatio?: number;
  metadata?: Prisma.InputJsonValue;
};

export type CreateMemoryItemInput = TenantScope & {
  conversationId?: string;
  sourceMessageId?: string;
  type?: MemoryType;
  status?: MemoryStatus;
  content: string;
  summary?: string;
  importance?: number;
  tokenCount?: number;
  provider?: string;
  model?: string;
  dimensions?: number;
  vector?: number[];
  metadata?: Prisma.InputJsonValue;
};

export type MemorySearchInput = TenantScope & {
  vector: number[];
  query?: string;
  conversationId?: string;
  types?: MemoryType[];
  limit?: number;
  minSimilarity?: number;
};

export type MemorySearchResult = {
  id: string;
  conversationId: string | null;
  sourceMessageId: string | null;
  type: MemoryType;
  content: string;
  summary: string | null;
  importance: number;
  tokenCount: number;
  metadata: Prisma.JsonValue;
  similarity: number;
  rankScore: number;
  createdAt: Date;
};

export type DocumentWithChunks = Document & {
  chunks: DocumentChunk[];
};

export type ConversationWithMessages = Conversation & {
  messages: Message[];
};

export type RagRecord =
  | Document
  | DocumentChunk
  | Embedding
  | Conversation
  | ConversationSummary
  | Message
  | MemoryItem
  | Prompt
  | RetrievalLog;

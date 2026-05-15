import type { ConnectorProvider, DocumentSourceType } from "@prisma/client";

export type ConnectorAuth = {
  accessToken?: string;
  refreshToken?: string;
  apiToken?: string;
  botToken?: string;
  baseUrl?: string;
};

export type ConnectorConfig = {
  driveId?: string;
  databaseId?: string;
  spaceKey?: string;
  channelId?: string;
  repository?: string;
  owner?: string;
  includeArchived?: boolean;
  syncIntervalMin?: number;
};

export type ConnectorDocument = {
  externalId: string;
  title: string;
  content: string;
  sourceUri?: string;
  mimeType?: string;
  updatedAt?: string;
  checksum?: string;
  metadata?: Record<string, unknown>;
};

export type ConnectorSyncInput = {
  connectorId: string;
  organizationId: string;
  cursor?: string | null;
  config: ConnectorConfig;
  auth: ConnectorAuth;
};

export type ConnectorSyncResult = {
  cursor: string | null;
  documents: ConnectorDocument[];
};

export type ConnectorAdapter = {
  provider: ConnectorProvider;
  sourceType: DocumentSourceType;
  displayName: string;
  sync(input: ConnectorSyncInput): Promise<ConnectorSyncResult>;
  verify(input: Omit<ConnectorSyncInput, "cursor" | "connectorId">): Promise<boolean>;
  handleWebhook?(payload: unknown): Promise<{ externalIds: string[]; cursor?: string | null }>;
};

import type { Document, DocumentSourceType, DocumentStatus, Prisma } from "@prisma/client";

export type SupportedUploadExtension = "pdf" | "docx" | "txt" | "md";

export type SupportedUploadMimeType =
  | "application/pdf"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "text/plain"
  | "text/markdown"
  | "text/x-markdown";

export type UploadValidationResult =
  | {
      ok: true;
      extension: SupportedUploadExtension;
      mimeType: SupportedUploadMimeType | "application/octet-stream";
    }
  | {
      ok: false;
      reason: string;
    };

export type StoredUpload = {
  storageKey: string;
  absolutePath: string;
  size: number;
  checksum: string;
};

export type ParsedDocument = {
  text: string;
  metadata: Prisma.InputJsonObject;
};

export type UploadQueueItem = {
  documentId: string;
  organizationId: string;
  createdById?: string;
  storageKey: string;
  absolutePath: string;
  filename: string;
  mimeType: string;
  sourceType: DocumentSourceType;
  size?: number;
  checksum?: string;
};

export type UploadHistoryItem = Pick<
  Document,
  | "id"
  | "title"
  | "status"
  | "sourceType"
  | "sourceUri"
  | "mimeType"
  | "chunkCount"
  | "tokenCount"
  | "errorMessage"
  | "createdAt"
  | "updatedAt"
> & {
  size?: number;
  checksum?: string;
};

export type UploadApiItem = {
  id: string;
  filename: string;
  status: DocumentStatus;
  size: number;
  checksum: string;
};

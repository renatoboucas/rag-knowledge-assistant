import type { StoredUpload } from "@/lib/uploads/types/upload";

export type StoragePutInput = {
  organizationId: string;
  documentId: string;
  file: File;
};

export interface StorageProvider {
  put(input: StoragePutInput): Promise<StoredUpload>;
  get(storageKey: string): Promise<Buffer>;
}

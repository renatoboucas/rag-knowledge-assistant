import type { ConnectorProvider, DocumentSourceType } from "@prisma/client";

import { BaseConnectorAdapter } from "@/lib/connectors/providers/base-adapter";
import type { ConnectorDocument, ConnectorSyncInput } from "@/lib/connectors/types";

export class GoogleDriveConnectorAdapter extends BaseConnectorAdapter {
  provider: ConnectorProvider = "GOOGLE_DRIVE";
  sourceType: DocumentSourceType = "GOOGLE_DRIVE";
  displayName = "Google Drive";

  protected endpoint(input: ConnectorSyncInput) {
    const query = encodeURIComponent("trashed = false");
    const fields = encodeURIComponent(
      "files(id,name,mimeType,webViewLink,modifiedTime,md5Checksum)",
    );
    const drive = input.config.driveId ? `&driveId=${input.config.driveId}&corpora=drive` : "";
    return `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}${drive}`;
  }

  protected mapRemoteItem(item: unknown): ConnectorDocument | null {
    if (!item || typeof item !== "object") {
      return null;
    }

    const file = item as Record<string, unknown>;
    const id = this.stringValue(file.id);
    const title = this.stringValue(file.name);

    if (!id || !title) {
      return null;
    }

    const mimeType = this.stringValue(file.mimeType);
    const sourceUri = this.stringValue(file.webViewLink);
    const content = `${title}\n${mimeType ?? "Google Drive file"}\n${sourceUri ?? ""}`;

    return {
      externalId: id,
      title,
      content,
      sourceUri,
      mimeType,
      updatedAt: this.stringValue(file.modifiedTime),
      checksum: this.stringValue(file.md5Checksum) ?? this.checksum(content),
      metadata: { provider: this.provider },
    };
  }
}

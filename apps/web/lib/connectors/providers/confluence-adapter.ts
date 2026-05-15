import type { ConnectorProvider, DocumentSourceType } from "@prisma/client";

import { BaseConnectorAdapter } from "@/lib/connectors/providers/base-adapter";
import type { ConnectorDocument, ConnectorSyncInput } from "@/lib/connectors/types";

export class ConfluenceConnectorAdapter extends BaseConnectorAdapter {
  provider: ConnectorProvider = "CONFLUENCE";
  sourceType: DocumentSourceType = "CONFLUENCE";
  displayName = "Confluence";

  protected endpoint(input: ConnectorSyncInput) {
    if (!input.auth.baseUrl) {
      return null;
    }

    const cql = encodeURIComponent(
      input.config.spaceKey ? `space=${input.config.spaceKey} and type=page` : "type=page",
    );
    return `${input.auth.baseUrl}/wiki/rest/api/content/search?cql=${cql}&expand=body.storage,version`;
  }

  protected mapRemoteItem(item: unknown): ConnectorDocument | null {
    if (!item || typeof item !== "object") {
      return null;
    }

    const page = item as Record<string, unknown>;
    const id = this.stringValue(page.id);
    const title = this.stringValue(page.title);

    if (!id || !title) {
      return null;
    }

    const body = page.body as { storage?: { value?: string } } | undefined;
    const content = `${title}\n${body?.storage?.value ?? ""}`;

    return {
      externalId: id,
      title,
      content,
      mimeType: "text/html",
      checksum: this.checksum(content),
      metadata: { provider: this.provider },
    };
  }
}

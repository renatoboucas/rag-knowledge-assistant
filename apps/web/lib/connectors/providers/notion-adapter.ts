import type { ConnectorProvider, DocumentSourceType } from "@prisma/client";

import { BaseConnectorAdapter } from "@/lib/connectors/providers/base-adapter";
import type { ConnectorDocument, ConnectorSyncInput } from "@/lib/connectors/types";

export class NotionConnectorAdapter extends BaseConnectorAdapter {
  provider: ConnectorProvider = "NOTION";
  sourceType: DocumentSourceType = "NOTION";
  displayName = "Notion";

  protected endpoint(input: ConnectorSyncInput) {
    return input.config.databaseId
      ? `https://api.notion.com/v1/databases/${input.config.databaseId}/query`
      : "https://api.notion.com/v1/search";
  }

  protected override headers(input: ConnectorSyncInput): HeadersInit {
    return {
      ...super.headers(input),
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    };
  }

  protected override requestInit(input: ConnectorSyncInput): RequestInit {
    return {
      method: "POST",
      headers: this.headers(input),
      body: JSON.stringify(input.config.databaseId ? {} : { page_size: 100 }),
    };
  }

  protected mapRemoteItem(item: unknown): ConnectorDocument | null {
    if (!item || typeof item !== "object") {
      return null;
    }

    const page = item as Record<string, unknown>;
    const id = this.stringValue(page.id);

    if (!id) {
      return null;
    }

    const title = this.extractTitle(page) ?? "Untitled Notion page";
    const sourceUri = this.stringValue(page.url);
    const content = `${title}\n${sourceUri ?? ""}`;

    return {
      externalId: id,
      title,
      content,
      sourceUri,
      mimeType: "application/notion",
      updatedAt: this.stringValue(page.last_edited_time),
      checksum: this.checksum(content),
      metadata: { provider: this.provider, object: page.object },
    };
  }

  private extractTitle(page: Record<string, unknown>) {
    const properties = page.properties;

    if (!properties || typeof properties !== "object") {
      return undefined;
    }

    for (const value of Object.values(properties as Record<string, unknown>)) {
      if (!value || typeof value !== "object") {
        continue;
      }

      const title = (value as { title?: Array<{ plain_text?: string }> }).title;

      if (Array.isArray(title) && title[0]?.plain_text) {
        return title.map((part) => part.plain_text ?? "").join("");
      }
    }

    return undefined;
  }
}

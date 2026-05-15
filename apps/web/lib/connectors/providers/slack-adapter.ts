import type { ConnectorProvider, DocumentSourceType } from "@prisma/client";

import { BaseConnectorAdapter } from "@/lib/connectors/providers/base-adapter";
import type { ConnectorDocument, ConnectorSyncInput } from "@/lib/connectors/types";

export class SlackConnectorAdapter extends BaseConnectorAdapter {
  provider: ConnectorProvider = "SLACK";
  sourceType: DocumentSourceType = "SLACK";
  displayName = "Slack";

  protected endpoint(input: ConnectorSyncInput) {
    if (!input.config.channelId) {
      return null;
    }

    return `https://slack.com/api/conversations.history?channel=${input.config.channelId}&limit=100`;
  }

  protected mapRemoteItem(item: unknown, input: ConnectorSyncInput): ConnectorDocument | null {
    if (!item || typeof item !== "object") {
      return null;
    }

    const message = item as Record<string, unknown>;
    const ts = this.stringValue(message.ts);
    const text = this.stringValue(message.text);

    if (!ts || !text) {
      return null;
    }

    return {
      externalId: ts,
      title: `Slack message ${ts}`,
      content: text,
      sourceUri: input.config.channelId
        ? `slack://channel/${input.config.channelId}/${ts}`
        : undefined,
      mimeType: "text/plain",
      updatedAt: new Date(Number(ts.split(".")[0]) * 1000).toISOString(),
      checksum: this.checksum(text),
      metadata: { provider: this.provider, channelId: input.config.channelId },
    };
  }
}

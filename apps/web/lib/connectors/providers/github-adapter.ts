import type { ConnectorProvider, DocumentSourceType } from "@prisma/client";

import { BaseConnectorAdapter } from "@/lib/connectors/providers/base-adapter";
import type { ConnectorDocument, ConnectorSyncInput } from "@/lib/connectors/types";

export class GitHubConnectorAdapter extends BaseConnectorAdapter {
  provider: ConnectorProvider = "GITHUB";
  sourceType: DocumentSourceType = "GITHUB";
  displayName = "GitHub";

  protected endpoint(input: ConnectorSyncInput) {
    const repo = input.config.repository;
    const owner = input.config.owner;

    if (!repo || !owner) {
      return null;
    }

    return `https://api.github.com/repos/${owner}/${repo}/issues?state=all&per_page=100`;
  }

  protected override headers(input: ConnectorSyncInput): HeadersInit {
    return {
      ...super.headers(input),
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  protected mapRemoteItem(item: unknown): ConnectorDocument | null {
    if (!item || typeof item !== "object") {
      return null;
    }

    const issue = item as Record<string, unknown>;
    const id = typeof issue.id === "number" ? String(issue.id) : this.stringValue(issue.id);
    const title = this.stringValue(issue.title);

    if (!id || !title) {
      return null;
    }

    const body = this.stringValue(issue.body) ?? "";
    const sourceUri = this.stringValue(issue.html_url);
    const content = `${title}\n${body}`;

    return {
      externalId: id,
      title,
      content,
      sourceUri,
      mimeType: "text/markdown",
      updatedAt: this.stringValue(issue.updated_at),
      checksum: this.checksum(content),
      metadata: { provider: this.provider, number: issue.number },
    };
  }
}

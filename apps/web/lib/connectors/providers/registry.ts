import type { ConnectorProvider } from "@prisma/client";

import type { ConnectorAdapter } from "@/lib/connectors/types";
import { ConfluenceConnectorAdapter } from "@/lib/connectors/providers/confluence-adapter";
import { GitHubConnectorAdapter } from "@/lib/connectors/providers/github-adapter";
import { GoogleDriveConnectorAdapter } from "@/lib/connectors/providers/google-drive-adapter";
import { NotionConnectorAdapter } from "@/lib/connectors/providers/notion-adapter";
import { SlackConnectorAdapter } from "@/lib/connectors/providers/slack-adapter";

const adapters = [
  new GoogleDriveConnectorAdapter(),
  new NotionConnectorAdapter(),
  new ConfluenceConnectorAdapter(),
  new SlackConnectorAdapter(),
  new GitHubConnectorAdapter(),
] satisfies ConnectorAdapter[];

export class ConnectorRegistry {
  list() {
    return adapters;
  }

  get(provider: ConnectorProvider) {
    const adapter = adapters.find((candidate) => candidate.provider === provider);

    if (!adapter) {
      throw new Error(`Unsupported connector provider: ${provider}`);
    }

    return adapter;
  }
}

export const connectorRegistry = new ConnectorRegistry();

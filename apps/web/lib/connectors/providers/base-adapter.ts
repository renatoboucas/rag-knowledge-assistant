import crypto from "node:crypto";

import type {
  ConnectorAdapter,
  ConnectorDocument,
  ConnectorSyncInput,
  ConnectorSyncResult,
} from "@/lib/connectors/types";

export abstract class BaseConnectorAdapter implements ConnectorAdapter {
  abstract provider: ConnectorAdapter["provider"];
  abstract sourceType: ConnectorAdapter["sourceType"];
  abstract displayName: string;

  protected abstract endpoint(input: ConnectorSyncInput): string | null;
  protected abstract mapRemoteItem(
    item: unknown,
    input: ConnectorSyncInput,
  ): ConnectorDocument | null;
  protected headers(input: ConnectorSyncInput): HeadersInit {
    const token = input.auth.accessToken ?? input.auth.apiToken ?? input.auth.botToken;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
  protected requestInit(input: ConnectorSyncInput): RequestInit {
    return { headers: this.headers(input) };
  }

  async verify(input: Omit<ConnectorSyncInput, "cursor" | "connectorId">) {
    return Boolean(input.auth.accessToken ?? input.auth.apiToken ?? input.auth.botToken);
  }

  async sync(input: ConnectorSyncInput): Promise<ConnectorSyncResult> {
    const endpoint = this.endpoint(input);

    if (!endpoint) {
      return { cursor: new Date().toISOString(), documents: [] };
    }

    const response = await fetch(endpoint, this.requestInit(input));

    if (!response.ok) {
      throw new Error(`${this.displayName} sync failed with ${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    const items = this.items(payload);
    const documents = items
      .map((item) => this.mapRemoteItem(item, input))
      .filter((document): document is ConnectorDocument => Boolean(document));

    return {
      cursor: new Date().toISOString(),
      documents,
    };
  }

  protected items(payload: unknown): unknown[] {
    if (!payload || typeof payload !== "object") {
      return [];
    }

    const candidates = payload as {
      files?: unknown;
      results?: unknown;
      values?: unknown;
      messages?: unknown;
      items?: unknown;
    };

    for (const value of [
      candidates.files,
      candidates.results,
      candidates.values,
      candidates.messages,
      candidates.items,
    ]) {
      if (Array.isArray(value)) {
        return value;
      }
    }

    return [];
  }

  protected checksum(value: string) {
    return crypto.createHash("sha256").update(value).digest("hex");
  }

  protected stringValue(value: unknown) {
    return typeof value === "string" ? value : undefined;
  }
}

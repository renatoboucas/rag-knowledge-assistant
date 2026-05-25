export const publicApiOpenApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "RAG Knowledge Assistant Public API",
    version: "1.0.0",
    description: "Tenant-scoped API for document search and retrieval-augmented context access.",
  },
  servers: [{ url: "/api/public/v1" }],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "RKA API key",
      },
    },
  },
  security: [{ ApiKeyAuth: [] }],
  paths: {
    "/documents": {
      get: {
        summary: "List indexed documents",
        parameters: [
          {
            name: "query",
            in: "query",
            required: false,
            schema: { type: "string" },
          },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1, maximum: 50, default: 20 },
          },
        ],
        responses: {
          "200": {
            description: "Documents visible to the API key organization.",
          },
        },
      },
    },
    "/retrieval": {
      post: {
        summary: "Run RAG retrieval",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["query"],
                properties: {
                  query: { type: "string", minLength: 3 },
                  mode: { type: "string", enum: ["semantic", "hybrid"], default: "hybrid" },
                  limit: { type: "integer", minimum: 1, maximum: 20, default: 8 },
                  minSimilarity: { type: "number", minimum: 0, maximum: 1 },
                  metadataFilter: { type: "object", additionalProperties: true },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Retrieved context, citations, and retrieval quality evaluation.",
          },
        },
      },
    },
  },
} as const;

export function typescriptSdkSource() {
  return `export type RetrievalMode = "semantic" | "hybrid";

export type RagClientOptions = {
  apiKey: string;
  baseUrl?: string;
};

export class RagKnowledgeAssistantClient {
  private readonly baseUrl: string;

  constructor(private readonly options: RagClientOptions) {
    this.baseUrl = options.baseUrl ?? "https://your-domain.com/api/public/v1";
  }

  async listDocuments(input: { query?: string; limit?: number } = {}) {
    const url = new URL(this.baseUrl + "/documents");
    if (input.query) url.searchParams.set("query", input.query);
    if (input.limit) url.searchParams.set("limit", String(input.limit));
    return this.request(url, { method: "GET" });
  }

  async retrieve(input: {
    query: string;
    mode?: RetrievalMode;
    limit?: number;
    minSimilarity?: number;
    metadataFilter?: Record<string, unknown>;
  }) {
    return this.request(this.baseUrl + "/retrieval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  }

  private async request(input: string | URL, init: RequestInit) {
    const response = await fetch(input, {
      ...init,
      headers: {
        Authorization: \`Bearer \${this.options.apiKey}\`,
        ...init.headers,
      },
    });

    if (!response.ok) {
      throw new Error(\`RAG API request failed: \${response.status} \${await response.text()}\`);
    }

    return response.json();
  }
}
`;
}

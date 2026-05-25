import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const KEY_PREFIX = "rka";
const SECRET_BYTES = 32;
const HASH_ALGORITHM = "sha256";

export type ApiKeyScope = "documents:read" | "retrieval:read" | "chat:write" | "evaluations:read";

const defaultScopes: ApiKeyScope[] = ["documents:read", "retrieval:read"];

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? {}));
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function generateApiKeySecret() {
  return `${KEY_PREFIX}_${crypto.randomBytes(SECRET_BYTES).toString("base64url")}`;
}

export function hashApiKey(secret: string) {
  return crypto.createHash(HASH_ALGORITHM).update(secret).digest("hex");
}

export function apiKeyPrefix(secret: string) {
  const separator = secret.indexOf("_");
  const namespace = separator >= 0 ? secret.slice(0, separator) : KEY_PREFIX;
  const token = separator >= 0 ? secret.slice(separator + 1) : secret;

  return `${namespace}_${token.slice(0, 8)}`;
}

export function redactApiKey(prefix: string) {
  return `${prefix}...`;
}

export function hasScope(scopes: string[], requiredScope: ApiKeyScope) {
  return scopes.includes(requiredScope) || scopes.includes("*");
}

export class ApiKeyService {
  async listApiKeys(organizationId: string) {
    const [keys, recentLogs] = await Promise.all([
      prisma.apiKey.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          prefix: true,
          scopes: true,
          rateLimitPerMinute: true,
          lastUsedAt: true,
          expiresAt: true,
          revokedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.apiRequestLog.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 25,
        include: { apiKey: { select: { id: true, name: true, prefix: true } } },
      }),
    ]);

    return {
      keys: keys.map((key) => ({
        ...key,
        displayKey: redactApiKey(key.prefix),
        scopes: stringArray(key.scopes),
        active: !key.revokedAt && (!key.expiresAt || key.expiresAt > new Date()),
      })),
      recentLogs,
    };
  }

  async createApiKey(input: {
    organizationId: string;
    createdById?: string;
    name: string;
    scopes?: ApiKeyScope[];
    rateLimitPerMinute?: number;
    expiresAt?: Date | null;
    metadata?: Prisma.InputJsonObject;
  }) {
    const secret = generateApiKeySecret();
    const key = await prisma.apiKey.create({
      data: {
        organizationId: input.organizationId,
        createdById: input.createdById,
        name: input.name,
        prefix: apiKeyPrefix(secret),
        keyHash: hashApiKey(secret),
        scopes: jsonValue(input.scopes?.length ? input.scopes : defaultScopes),
        rateLimitPerMinute: input.rateLimitPerMinute ?? 60,
        expiresAt: input.expiresAt,
        metadata: jsonValue(input.metadata),
      },
    });

    return {
      key: {
        ...key,
        displayKey: redactApiKey(key.prefix),
        scopes: stringArray(key.scopes),
        active: true,
      },
      secret,
    };
  }

  async revokeApiKey(input: { organizationId: string; keyId: string }) {
    return prisma.apiKey.update({
      where: { id: input.keyId, organizationId: input.organizationId },
      data: { revokedAt: new Date() },
    });
  }

  async authenticate(secret: string) {
    const key = await prisma.apiKey.findUnique({
      where: { keyHash: hashApiKey(secret) },
      include: { organization: true },
    });

    if (!key || key.revokedAt || (key.expiresAt && key.expiresAt <= new Date())) {
      return null;
    }

    return {
      key,
      organization: key.organization,
      scopes: stringArray(key.scopes),
    };
  }

  async recordUsage(input: {
    organizationId: string;
    apiKeyId?: string;
    method: string;
    path: string;
    status: number;
    latencyMs: number;
    request: Request;
    metadata?: Record<string, unknown>;
  }) {
    const ipAddress = input.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const userAgent = input.request.headers.get("user-agent");

    await prisma.$transaction([
      prisma.apiRequestLog.create({
        data: {
          organizationId: input.organizationId,
          apiKeyId: input.apiKeyId,
          method: input.method,
          path: input.path,
          status: input.status,
          latencyMs: input.latencyMs,
          ipAddress,
          userAgent,
          metadata: jsonValue(input.metadata),
        },
      }),
      ...(input.apiKeyId
        ? [
            prisma.apiKey.update({
              where: { id: input.apiKeyId },
              data: { lastUsedAt: new Date() },
            }),
          ]
        : []),
    ]);
  }
}

export const apiKeyService = new ApiKeyService();

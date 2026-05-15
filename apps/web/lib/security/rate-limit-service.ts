import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
};

function windowStart(now: Date, seconds: number) {
  return new Date(Math.floor(now.getTime() / (seconds * 1000)) * seconds * 1000);
}

export class RateLimitService {
  async check(input: {
    key: string;
    route: string;
    organizationId?: string;
    limit?: number;
    windowSeconds?: number;
  }): Promise<RateLimitDecision> {
    const now = new Date();
    const windowSeconds = input.windowSeconds ?? env.RATE_LIMIT_WINDOW_SECONDS;
    const limit = input.limit ?? env.RATE_LIMIT_REQUESTS;
    const start = windowStart(now, windowSeconds);
    const resetAt = new Date(start.getTime() + windowSeconds * 1000);

    const bucket = await prisma.rateLimitBucket.upsert({
      where: {
        key_route_windowStart: {
          key: input.key,
          route: input.route,
          windowStart: start,
        },
      },
      update: { count: { increment: 1 }, expiresAt: resetAt },
      create: {
        key: input.key,
        route: input.route,
        organizationId: input.organizationId,
        count: 1,
        windowStart: start,
        expiresAt: resetAt,
      },
    });

    return {
      allowed: bucket.count <= limit,
      limit,
      remaining: Math.max(0, limit - bucket.count),
      resetAt,
    };
  }
}

export const rateLimiter = new RateLimitService();

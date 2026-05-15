import { PostHog } from "posthog-node";

import { env } from "@/lib/env";

const globalForPostHog = globalThis as unknown as {
  posthog?: PostHog;
};

export function getPostHogServerClient() {
  if (!env.POSTHOG_KEY) {
    return null;
  }

  globalForPostHog.posthog ??= new PostHog(env.POSTHOG_KEY, {
    host: env.POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
  });

  return globalForPostHog.posthog;
}

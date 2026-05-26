import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import type { Server } from "socket.io";

import { env } from "@/lib/env";

export async function configureRedisAdapter(io: Server) {
  if (!env.REDIS_URL) {
    return { enabled: false };
  }

  const publisher = createClient({ url: env.REDIS_URL });
  const subscriber = publisher.duplicate();

  await Promise.all([publisher.connect(), subscriber.connect()]);
  io.adapter(createAdapter(publisher, subscriber));

  return {
    enabled: true,
    async close() {
      await Promise.all([publisher.quit(), subscriber.quit()]);
    },
  };
}

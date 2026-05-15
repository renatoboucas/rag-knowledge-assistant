import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { TransactionCallback } from "@/lib/db/types/prisma";

export function withTransaction<T>(
  callback: TransactionCallback<T>,
  options?: {
    isolationLevel?: Prisma.TransactionIsolationLevel;
    maxWait?: number;
    timeout?: number;
  },
) {
  return prisma.$transaction(callback, {
    isolationLevel: options?.isolationLevel,
    maxWait: options?.maxWait,
    timeout: options?.timeout,
  });
}

import type { Prisma, PrismaClient } from "@prisma/client";

export type DbClient = PrismaClient | Prisma.TransactionClient;

export type TransactionCallback<T> = (tx: Prisma.TransactionClient) => Promise<T>;

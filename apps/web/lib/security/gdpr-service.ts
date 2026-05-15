import { prisma } from "@/lib/prisma";

export class GdprService {
  async exportUserData(input: { organizationId: string; userId: string }) {
    const [user, messages, documents, auditLogs] = await Promise.all([
      prisma.user.findFirst({
        where: {
          id: input.userId,
          memberships: { some: { organizationId: input.organizationId } },
        },
      }),
      prisma.message.findMany({
        where: { organizationId: input.organizationId, userId: input.userId, deletedAt: null },
      }),
      prisma.document.findMany({
        where: { organizationId: input.organizationId, createdById: input.userId, deletedAt: null },
      }),
      prisma.auditLog.findMany({
        where: { organizationId: input.organizationId, userId: input.userId },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
    ]);

    return {
      exportedAt: new Date(),
      user,
      messages,
      documents,
      auditLogs,
    };
  }

  async softDeleteUserData(input: { organizationId: string; userId: string }) {
    const deletedAt = new Date();

    await prisma.$transaction([
      prisma.message.updateMany({
        where: { organizationId: input.organizationId, userId: input.userId, deletedAt: null },
        data: { deletedAt },
      }),
      prisma.document.updateMany({
        where: { organizationId: input.organizationId, createdById: input.userId, deletedAt: null },
        data: { deletedAt, status: "ARCHIVED" },
      }),
      prisma.membership.updateMany({
        where: { organizationId: input.organizationId, userId: input.userId },
        data: { status: "SUSPENDED" },
      }),
    ]);

    return { deletedAt };
  }
}

export const gdpr = new GdprService();

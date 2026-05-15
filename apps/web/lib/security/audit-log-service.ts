import { prisma } from "@/lib/prisma";
import { redactSecrets } from "@/lib/security/redaction";

export type AuditInput = {
  organizationId?: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  outcome?: "success" | "failure" | "blocked";
  request?: Request;
  metadata?: unknown;
};

function header(request: Request | undefined, name: string) {
  return request?.headers.get(name) ?? undefined;
}

export class AuditLogService {
  async record(input: AuditInput) {
    await prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId,
        outcome: input.outcome ?? "success",
        ipAddress: header(input.request, "x-forwarded-for")?.split(",")[0]?.trim(),
        userAgent: header(input.request, "user-agent"),
        metadata: JSON.parse(JSON.stringify(redactSecrets(input.metadata ?? {}))),
      },
    });
  }
}

export const auditLog = new AuditLogService();

import { Prisma } from "@prisma/client";
import { SafeUser } from "@/lib/auth";
import { getClientIp, sanitizeLogValue } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type AuditInput = {
  actor?: Pick<SafeUser, "id"> | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Prisma.InputJsonObject;
  request?: Request;
};

export async function writeAuditLog(input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: input.actor?.id,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: input.metadata,
        ip: input.request ? getClientIp(input.request) : undefined,
        userAgent: input.request?.headers.get("user-agent") ?? undefined,
      },
    });
  } catch (error) {
    console.error(sanitizeLogValue(error));
  }
}

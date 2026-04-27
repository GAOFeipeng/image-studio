import { requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { handleError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();

    const auditLogs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        actor: { select: { id: true, email: true, role: true } },
      },
    });

    await writeAuditLog({
      actor: admin,
      action: "admin.audit_logs.view",
      targetType: "AuditLog",
      metadata: { count: auditLogs.length },
      request,
    });

    return ok({ auditLogs });
  } catch (error) {
    return handleError(error);
  }
}

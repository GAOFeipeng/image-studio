import { requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { handleError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();

    const tasks = await prisma.turn.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: { select: { id: true, email: true, role: true } },
        session: { select: { id: true, title: true } },
      },
    });

    await writeAuditLog({
      actor: admin,
      action: "admin.tasks.view",
      targetType: "Turn",
      metadata: { count: tasks.length },
      request,
    });

    return ok({ tasks });
  } catch (error) {
    return handleError(error);
  }
}

import { requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { handleError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        _count: { select: { sessions: true, turns: true, assets: true } },
      },
    });

    await writeAuditLog({
      actor: admin,
      action: "admin.users.view",
      targetType: "User",
      metadata: { count: users.length },
      request,
    });

    return ok({ users });
  } catch (error) {
    return handleError(error);
  }
}

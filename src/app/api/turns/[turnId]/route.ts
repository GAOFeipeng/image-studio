import { TurnStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { HttpError, handleError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ turnId: string }> };

export async function DELETE(request: Request, context: Params) {
  try {
    const user = await requireUser();
    const { turnId } = await context.params;
    const turn = await prisma.turn.findUnique({
      where: { id: turnId },
      select: {
        id: true,
        userId: true,
        sessionId: true,
        status: true,
      },
    });

    if (!turn) {
      throw new HttpError(404, "Turn not found", "turn_not_found");
    }

    if (user.role !== "ADMIN" && turn.userId !== user.id) {
      throw new HttpError(403, "You cannot dismiss this turn", "forbidden");
    }

    if (turn.status !== TurnStatus.CANCELLED) {
      if (turn.status !== TurnStatus.FAILED) {
        throw new HttpError(400, "Only failed turns can be dismissed", "invalid_turn_status");
      }

      await prisma.turn.update({
        where: { id: turn.id },
        data: { status: TurnStatus.CANCELLED },
      });
      await writeAuditLog({
        actor: user,
        action: "turn.dismissed",
        targetType: "Turn",
        targetId: turn.id,
        metadata: { sessionId: turn.sessionId },
        request,
      });
    }

    return ok({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}

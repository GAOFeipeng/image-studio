import { TurnType } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { HttpError, handleError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { runEdit, runGeneration } from "@/lib/services/image-workflow";

type Params = { params: Promise<{ turnId: string }> };

export async function POST(_request: Request, context: Params) {
  try {
    const user = await requireUser();
    const { turnId } = await context.params;
    const turn = await prisma.turn.findUnique({
      where: { id: turnId },
      include: { session: true },
    });

    if (!turn) {
      throw new HttpError(404, "Turn not found", "turn_not_found");
    }

    if (user.role !== "ADMIN" && turn.userId !== user.id) {
      throw new HttpError(403, "You cannot retry this turn", "forbidden");
    }

    if (turn.type === TurnType.GENERATION) {
      return ok(
        await runGeneration({
          user,
          sessionId: turn.sessionId,
          prompt: turn.prompt,
          params: turn.params as { model: string },
          parentTurnId: turn.parentTurnId,
          retryOfTurnId: turn.id,
          attempt: turn.attempt + 1,
        }),
      );
    }

    const inputAssetIds = Array.isArray(turn.inputAssetIds)
      ? turn.inputAssetIds.filter((id): id is string => typeof id === "string")
      : [];

    return ok(
      await runEdit({
        user,
        sessionId: turn.sessionId,
        prompt: turn.prompt,
        params: turn.params as { model: string },
        inputAssetIds,
        maskAssetId: turn.maskAssetId,
        parentTurnId: turn.parentTurnId,
        retryOfTurnId: turn.id,
        attempt: turn.attempt + 1,
      }),
    );
  } catch (error) {
    return handleError(error);
  }
}

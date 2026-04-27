import { requireUser } from "@/lib/auth";
import { handleError, ok } from "@/lib/http";
import { listSessionTurns } from "@/lib/services/image-workflow";

type Params = { params: Promise<{ sessionId: string }> };

export async function GET(_request: Request, context: Params) {
  try {
    const user = await requireUser();
    const { sessionId } = await context.params;
    const turns = await listSessionTurns(user, sessionId);
    return ok({ turns });
  } catch (error) {
    return handleError(error);
  }
}

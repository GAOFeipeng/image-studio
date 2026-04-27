import { handleError, ok } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { deleteSession, getAccessibleSession } from "@/lib/services/image-workflow";

type Params = { params: Promise<{ sessionId: string }> };

export async function GET(_request: Request, context: Params) {
  try {
    const user = await requireUser();
    const { sessionId } = await context.params;
    const session = await getAccessibleSession(user, sessionId);
    return ok({ session });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(_request: Request, context: Params) {
  try {
    const user = await requireUser();
    const { sessionId } = await context.params;
    await deleteSession(user, sessionId);
    return ok({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}

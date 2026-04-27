import { createSessionSchema } from "@/lib/images/validation";
import { handleError, ok } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { createSession, listSessions } from "@/lib/services/image-workflow";

export async function GET() {
  try {
    const user = await requireUser();
    const sessions = await listSessions(user);
    return ok({ sessions });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = createSessionSchema.parse(await request.json());
    const session = await createSession(user, body.title);
    return ok({ session });
  } catch (error) {
    return handleError(error);
  }
}

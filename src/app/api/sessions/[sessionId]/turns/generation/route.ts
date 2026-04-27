import { requireUser } from "@/lib/auth";
import { rawGenerationSchema } from "@/lib/images/validation";
import { handleError, ok } from "@/lib/http";
import { runGeneration } from "@/lib/services/image-workflow";
import { applyImageParamDefaults } from "@/lib/settings";

type Params = { params: Promise<{ sessionId: string }> };

export async function POST(request: Request, context: Params) {
  try {
    const user = await requireUser();
    const { sessionId } = await context.params;
    const body = rawGenerationSchema.parse(await request.json());
    const result = await runGeneration({
      user,
      sessionId,
      prompt: body.prompt,
      params: await applyImageParamDefaults(body.params, user),
      parentTurnId: body.parentTurnId,
    });
    return ok(result);
  } catch (error) {
    return handleError(error);
  }
}

import { requireUser } from "@/lib/auth";
import { rawEditSchema } from "@/lib/images/validation";
import { handleError, ok } from "@/lib/http";
import { runEdit } from "@/lib/services/image-workflow";
import { applyImageParamDefaults } from "@/lib/settings";

type Params = { params: Promise<{ sessionId: string }> };

export async function POST(request: Request, context: Params) {
  try {
    const user = await requireUser();
    const { sessionId } = await context.params;
    const body = rawEditSchema.parse(await request.json());
    const result = await runEdit({
      user,
      sessionId,
      prompt: body.prompt,
      params: await applyImageParamDefaults(body.params, user),
      inputAssetIds: body.inputAssetIds,
      maskAssetId: body.maskAssetId,
      parentTurnId: body.parentTurnId,
    });
    return ok(result);
  } catch (error) {
    return handleError(error);
  }
}

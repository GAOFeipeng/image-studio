import { AssetKind } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handleError, ok } from "@/lib/http";
import { assertUploadAllowed } from "@/lib/images/validation";
import { listSessionAssets, uploadSessionAsset } from "@/lib/services/image-workflow";

type Params = { params: Promise<{ sessionId: string }> };

const kindSchema = z.enum(["INPUT", "MASK", "REFERENCE"]).default("INPUT");

export async function GET(_request: Request, context: Params) {
  try {
    const user = await requireUser();
    const { sessionId } = await context.params;
    const assets = await listSessionAssets(user, sessionId);
    return ok({ assets });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request, context: Params) {
  try {
    const user = await requireUser();
    const { sessionId } = await context.params;
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return ok({ error: { code: "missing_file", message: "Missing file" } }, { status: 400 });
    }

    assertUploadAllowed(file);
    const kind = kindSchema.parse(form.get("kind")?.toString() ?? "INPUT") as AssetKind;
    const asset = await uploadSessionAsset({ user, sessionId, file, kind });
    return ok({ asset });
  } catch (error) {
    return handleError(error);
  }
}

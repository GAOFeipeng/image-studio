import { requireUser } from "@/lib/auth";
import { HttpError, handleError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { serializeAsset } from "@/lib/services/image-workflow";

type Params = { params: Promise<{ assetId: string }> };

export async function GET(_request: Request, context: Params) {
  try {
    const user = await requireUser();
    const { assetId } = await context.params;
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });

    if (!asset) {
      throw new HttpError(404, "Asset not found", "asset_not_found");
    }

    if (user.role !== "ADMIN" && asset.ownerId !== user.id) {
      throw new HttpError(403, "You cannot access this asset", "forbidden");
    }

    return ok({ asset: serializeAsset(asset) });
  } catch (error) {
    return handleError(error);
  }
}

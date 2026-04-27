import { requireUser } from "@/lib/auth";
import { HttpError, handleError } from "@/lib/http";
import { extensionForMime } from "@/lib/images/validation";
import { prisma } from "@/lib/prisma";
import { readBuffer, statBuffer } from "@/lib/storage/local";

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

    const [buffer, fileStat] = await Promise.all([
      readBuffer(asset.storageKey),
      statBuffer(asset.storageKey),
    ]);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": asset.mimeType,
        "Content-Length": String(fileStat.size),
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": `inline; filename="${asset.id}.${extensionForMime(asset.mimeType)}"`,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}

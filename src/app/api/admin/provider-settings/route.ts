import { requireAdmin } from "@/lib/auth";
import { handleError, ok } from "@/lib/http";
import {
  getPublicImageProviderSettings,
  imageProviderSettingsSchema,
  updateImageProviderSettings,
} from "@/lib/settings";

export async function GET() {
  try {
    await requireAdmin();
    return ok({ settings: await getPublicImageProviderSettings() });
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireAdmin();
    const body = imageProviderSettingsSchema.parse(await request.json());
    return ok({ settings: await updateImageProviderSettings(body, user) });
  } catch (error) {
    return handleError(error);
  }
}

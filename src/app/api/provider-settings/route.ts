import { requireUser } from "@/lib/auth";
import { handleError, ok } from "@/lib/http";
import {
  getPublicImageProviderSettings,
  imageProviderSettingsSchema,
  updateUserImageProviderSettings,
} from "@/lib/settings";

export async function GET() {
  try {
    const user = await requireUser();
    return ok({ settings: await getPublicImageProviderSettings(user) });
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    const body = imageProviderSettingsSchema.parse(await request.json());
    return ok({ settings: await updateUserImageProviderSettings(body, user) });
  } catch (error) {
    return handleError(error);
  }
}

import { requireUser } from "@/lib/auth";
import { handleError, ok } from "@/lib/http";
import { getPublicImageProviderSettings } from "@/lib/settings";

export async function GET() {
  try {
    await requireUser();
    return ok({ settings: await getPublicImageProviderSettings() });
  } catch (error) {
    return handleError(error);
  }
}

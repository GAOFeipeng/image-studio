import { env } from "@/lib/env";
import { MockImageProvider } from "@/lib/providers/mock";
import { OpenAICompatibleImageProvider } from "@/lib/providers/openai-compatible";
import { getImageProviderSettings } from "@/lib/settings";
import { normalizeProviderBaseUrl } from "@/lib/security/urls";

export async function getImageProvider() {
  const settings = await getImageProviderSettings();

  if (settings.provider === "mock") {
    return new MockImageProvider();
  }

  return new OpenAICompatibleImageProvider({
    apiBaseUrl: normalizeProviderBaseUrl(settings.apiBaseUrl),
    generationPath: settings.generationPath,
    editPath: settings.editPath,
    apiKey: settings.apiKey,
    timeoutMs: env.IMAGE_REQUEST_TIMEOUT_MS,
  });
}

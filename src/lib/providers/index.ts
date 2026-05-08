import { env } from "@/lib/env";
import { SafeUser } from "@/lib/auth";
import { MockImageProvider } from "@/lib/providers/mock";
import { OpenAICompatibleImageProvider } from "@/lib/providers/openai-compatible";
import { OpenAIResponsesImageProvider } from "@/lib/providers/openai-responses";
import { getImageProviderSettings } from "@/lib/settings";
import { normalizeProviderBaseUrl } from "@/lib/security/urls";

export async function getImageProvider(user: SafeUser) {
  const settings = await getImageProviderSettings(user);

  if (settings.provider === "mock") {
    return new MockImageProvider();
  }

  if (settings.provider === "openai-responses") {
    return new OpenAIResponsesImageProvider({
      apiBaseUrl: normalizeProviderBaseUrl(settings.apiBaseUrl),
      responsesPath: settings.generationPath,
      responsesModel: settings.responsesModel,
      apiKey: settings.apiKey,
      timeoutMs: env.IMAGE_REQUEST_TIMEOUT_MS,
    });
  }

  return new OpenAICompatibleImageProvider({
    apiBaseUrl: normalizeProviderBaseUrl(settings.apiBaseUrl),
    generationPath: settings.generationPath,
    editPath: settings.editPath,
    apiKey: settings.apiKey,
    timeoutMs: env.IMAGE_REQUEST_TIMEOUT_MS,
  });
}

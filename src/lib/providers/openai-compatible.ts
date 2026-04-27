import { HttpError } from "@/lib/http";
import {
  EditImageInput,
  GenerateImageInput,
  ImageProvider,
  ProviderResult,
} from "@/lib/providers/types";
import { assertProviderPath } from "@/lib/security/urls";

type OpenAIImageResponse = {
  created?: number;
  data?: Array<{
    b64_json?: string;
    url?: string;
    revised_prompt?: string;
  }>;
};

type OpenAICompatibleConfig = {
  apiBaseUrl: string;
  generationPath: string;
  editPath: string;
  apiKey?: string;
  timeoutMs: number;
};

export class OpenAICompatibleImageProvider implements ImageProvider {
  name = "openai-compatible";

  constructor(private config: OpenAICompatibleConfig) {}

  async generate(input: GenerateImageInput): Promise<ProviderResult> {
    const response = await this.fetchWithTimeout(this.url(this.config.generationPath), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: input.prompt,
        model: input.params.model,
        size: input.params.size,
        quality: input.params.quality,
        background: input.params.background,
        n: input.params.n,
        seed: input.params.seed,
        response_format: "b64_json",
        user: input.userId,
      }),
    });

    return this.parse(response);
  }

  async edit(input: EditImageInput): Promise<ProviderResult> {
    const form = new FormData();
    form.set("prompt", input.prompt);
    form.set("model", input.params.model);
    if (input.params.size) form.set("size", input.params.size);
    if (input.params.quality) form.set("quality", input.params.quality);
    if (input.params.n) form.set("n", String(input.params.n));
    form.set("response_format", "b64_json");
    form.set("user", input.userId);

    for (const image of input.images) {
      form.append("image", new Blob([toBlobPart(image.buffer)], { type: image.mimeType }), image.filename);
    }

    if (input.mask) {
      form.set("mask", new Blob([toBlobPart(input.mask.buffer)], { type: input.mask.mimeType }), input.mask.filename);
    }

    const response = await this.fetchWithTimeout(this.url(this.config.editPath), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey()}`,
      },
      body: form,
    });

    return this.parse(response);
  }

  private apiKey() {
    if (!this.config.apiKey || this.config.apiKey === "server-only-secret") {
      throw new HttpError(500, "Image provider API key is not configured", "provider_not_configured");
    }

    return this.config.apiKey;
  }

  private url(path: string) {
    assertProviderPath(path, "Provider API path");
    return new URL(path, this.config.apiBaseUrl).toString();
  }

  private async fetchWithTimeout(url: string, init: RequestInit) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (!response.ok) {
        const requestId = response.headers.get("x-request-id") ?? response.headers.get("x-correlation-id");
        const requestIdSuffix = requestId ? ` request_id=${requestId}` : "";
        throw new HttpError(
          502,
          `Image provider request failed (${response.status} ${response.statusText})${requestIdSuffix}`,
          "provider_error",
        );
      }

      return response;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new HttpError(504, "Image provider request timed out", "provider_timeout");
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async parse(response: Response): Promise<ProviderResult> {
    const json = (await response.json()) as OpenAIImageResponse;
    const images =
      json.data?.map((item) => ({
        b64Json: item.b64_json,
        url: item.url,
        revisedPrompt: item.revised_prompt,
        mimeType: "image/png",
      })) ?? [];

    if (images.length === 0) {
      throw new HttpError(502, "Image provider returned no images", "provider_empty_response");
    }

    return {
      requestId: response.headers.get("x-request-id") ?? undefined,
      revisedPrompt: images.find((image) => image.revisedPrompt)?.revisedPrompt,
      images,
    };
  }
}

function toBlobPart(buffer: Buffer): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(buffer.byteLength);
  bytes.set(buffer);
  return bytes;
}

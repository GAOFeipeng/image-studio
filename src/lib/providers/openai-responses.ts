import { HttpError } from "@/lib/http";
import { providerHttpError } from "@/lib/providers/errors";
import {
  EditImageInput,
  EditableImage,
  GenerateImageInput,
  ImageProvider,
  ImageParams,
  ProviderImage,
  ProviderResult,
} from "@/lib/providers/types";
import { assertProviderPath } from "@/lib/security/urls";

type OpenAIResponsesConfig = {
  apiBaseUrl: string;
  responsesPath: string;
  responsesModel?: string;
  apiKey?: string;
  timeoutMs: number;
};

type ResponsesImageToolCall = {
  type?: string;
  status?: string;
  result?: string;
  revised_prompt?: string;
};

type ResponsesResponse = {
  id?: string;
  status?: string;
  error?: { message?: string; code?: string } | null;
  output?: ResponsesImageToolCall[];
};

type ResponsesStreamEvent = {
  type?: string;
  response?: ResponsesResponse;
  item?: ResponsesImageToolCall;
  delta?: unknown;
};

export class OpenAIResponsesImageProvider implements ImageProvider {
  name = "openai-responses";

  constructor(private config: OpenAIResponsesConfig) {}

  async generate(input: GenerateImageInput): Promise<ProviderResult> {
    return this.createResponse({
      input: input.prompt,
      params: input.params,
      action: "generate",
    });
  }

  async edit(input: EditImageInput): Promise<ProviderResult> {
    return this.createResponse({
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: input.prompt,
            },
            ...input.images.map((image) => ({
              type: "input_image",
              image_url: dataUrl(image.buffer, image.mimeType),
              detail: "auto",
            })),
          ],
        },
      ],
      params: input.params,
      action: "edit",
      mask: input.mask,
    });
  }

  private async createResponse(options: {
    input: unknown;
    params: ImageParams;
    action: "generate" | "edit";
    mask?: EditableImage;
  }) {
    const response = await this.fetchWithTimeout(this.url(this.config.responsesPath), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        openAIResponsesImageRequestBody({
          input: options.input,
          params: options.params,
          responsesModel: this.config.responsesModel,
        }),
      ),
    });

    return parseOpenAIResponsesImageResult(await response.text(), response.headers.get("content-type"), {
      requestId: response.headers.get("x-request-id") ?? undefined,
    });
  }

  private apiKey() {
    if (!this.config.apiKey || this.config.apiKey === "server-only-secret") {
      throw new HttpError(500, "Image provider API key is not configured", "provider_not_configured");
    }

    return this.config.apiKey;
  }

  private url(path: string) {
    assertProviderPath(path, "Responses path");
    return new URL(path, this.config.apiBaseUrl).toString();
  }

  private async fetchWithTimeout(url: string, init: RequestInit) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (!response.ok) {
        throw await providerHttpError(response);
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
}

export function parseOpenAIResponsesImageResult(
  body: string,
  contentType?: string | null,
  metadata: { requestId?: string } = {},
): ProviderResult {
  const response = contentType?.includes("text/event-stream") ? parseResponsesEventStream(body) : parseJson(body);
  const images = imagesFromResponse(response);

  if (images.length === 0) {
    const message = response.error?.message ?? "Image provider returned no images";
    throw new HttpError(502, message, "provider_empty_response");
  }

  return {
    requestId: metadata.requestId ?? response.id,
    revisedPrompt: images.find((image) => image.revisedPrompt)?.revisedPrompt,
    images,
  };
}

export function openAIResponsesImageRequestBody(options: {
  input: unknown;
  params: ImageParams;
  responsesModel?: string;
}) {
  return {
    model: responsesModel(options.params.model, options.responsesModel),
    input: options.input,
    tools: [imageGenerationTool(options.params)],
    tool_choice: { type: "image_generation" },
    stream: true,
  };
}

function imageGenerationTool(params: ImageParams) {
  return stripUndefined({
    type: "image_generation",
    size: params.size,
    quality: params.quality,
    background: params.background,
  });
}

export function responsesModel(imageModel: string, configuredResponsesModel?: string) {
  const model = configuredResponsesModel?.trim();
  if (model) {
    return model;
  }

  if (/^gpt-image-/i.test(imageModel)) {
    return "gpt-5";
  }

  return imageModel;
}

function parseResponsesEventStream(body: string): ResponsesResponse {
  let completed: ResponsesResponse | null = null;
  const outputById = new Map<string, ResponsesImageToolCall>();

  for (const eventText of body.split(/\r?\n\r?\n/)) {
    const data = eventText
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trimStart())
      .join("\n");

    if (!data || data === "[DONE]") {
      continue;
    }

    const event = parseJson(data) as ResponsesStreamEvent;
    if (event.response) {
      completed = event.response;
      for (const output of event.response.output ?? []) {
        rememberOutput(outputById, output);
      }
    }

    if (event.item) {
      rememberOutput(outputById, event.item);
    }
  }

  return {
    ...completed,
    output: [...(completed?.output ?? []), ...outputById.values()],
  };
}

function imagesFromResponse(response: ResponsesResponse): ProviderImage[] {
  return (
    response.output
      ?.filter((output) => output.type === "image_generation_call" && typeof output.result === "string")
      .map((output) => ({
        b64Json: output.result,
        revisedPrompt: output.revised_prompt,
        mimeType: "image/png",
      })) ?? []
  );
}

function rememberOutput(map: Map<string, ResponsesImageToolCall>, output: ResponsesImageToolCall) {
  if (output.type !== "image_generation_call") {
    return;
  }

  const key = output.result ?? output.revised_prompt ?? JSON.stringify(output);
  map.set(key, output);
}

function parseJson(value: string): ResponsesResponse {
  try {
    return JSON.parse(value) as ResponsesResponse;
  } catch {
    throw new HttpError(502, "Image provider returned an invalid response", "provider_invalid_response");
  }
}

function dataUrl(buffer: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function stripUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined));
}

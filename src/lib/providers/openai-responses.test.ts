import { describe, expect, it } from "vitest";
import {
  openAIResponsesImageRequestBody,
  parseOpenAIResponsesImageResult,
  responsesModel,
} from "@/lib/providers/openai-responses";

describe("OpenAI Responses image provider", () => {
  it("parses image_generation_call results from JSON responses", () => {
    const result = parseOpenAIResponsesImageResult(
      JSON.stringify({
        id: "resp_123",
        output: [
          {
            type: "image_generation_call",
            result: "aW1hZ2U=",
            revised_prompt: "A refined prompt",
          },
        ],
      }),
      "application/json",
    );

    expect(result.requestId).toBe("resp_123");
    expect(result.revisedPrompt).toBe("A refined prompt");
    expect(result.images).toEqual([{ b64Json: "aW1hZ2U=", revisedPrompt: "A refined prompt", mimeType: "image/png" }]);
  });

  it("parses image_generation_call results from streamed response.completed events", () => {
    const result = parseOpenAIResponsesImageResult(
      [
        'event: response.created\ndata: {"type":"response.created","response":{"id":"resp_123","output":[]}}',
        'event: response.completed\ndata: {"type":"response.completed","response":{"id":"resp_123","output":[{"type":"image_generation_call","result":"aW1hZ2U="}]}}',
        "data: [DONE]",
      ].join("\n\n"),
      "text/event-stream",
    );

    expect(result.requestId).toBe("resp_123");
    expect(result.images[0]?.b64Json).toBe("aW1hZ2U=");
  });

  it("uses a configured outer Responses model when one is provided", () => {
    expect(responsesModel("gpt-image-2", "gpt-4.1")).toBe("gpt-4.1");
    expect(responsesModel("gpt-image-2")).toBe("gpt-5");
  });

  it("forces the image generation tool in Responses requests", () => {
    expect(
      openAIResponsesImageRequestBody({
        input: "draw a clean product render",
        params: {
          model: "gpt-image-2",
          size: "1024x1024",
          quality: "auto",
        },
      }),
    ).toEqual({
      model: "gpt-5",
      input: "draw a clean product render",
      tools: [
        {
          type: "image_generation",
          size: "1024x1024",
          quality: "auto",
        },
      ],
      tool_choice: {
        type: "image_generation",
      },
      stream: true,
    });
  });
});

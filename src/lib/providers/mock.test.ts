import { describe, expect, it } from "vitest";
import { MockImageProvider } from "@/lib/providers/mock";

describe("mock image provider", () => {
  it("returns the requested number of images", async () => {
    const provider = new MockImageProvider();
    const result = await provider.generate({
      prompt: "a studio product shot",
      userId: "user_1",
      params: { model: "mock", n: 3 },
    });

    expect(result.images).toHaveLength(3);
    expect(result.images[0].b64Json).toBeTruthy();
    expect(result.images[0].mimeType).toBe("image/png");
  });
});

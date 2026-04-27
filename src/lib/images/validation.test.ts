import { describe, expect, it } from "vitest";
import {
  assertGeneratedImageAllowed,
  assertUploadAllowed,
  extensionForMime,
  generationSchema,
} from "@/lib/images/validation";

describe("image validation", () => {
  it("applies generation defaults", () => {
    const parsed = generationSchema.parse({ prompt: "draw a product photo" });
    expect(parsed.params.model).toBe("gpt-image-2");
    expect(parsed.params.size).toBe("1024x1024");
    expect(parsed.params.n).toBe(1);
  });

  it("maps mime types to file extensions", () => {
    expect(extensionForMime("image/png")).toBe("png");
    expect(extensionForMime("image/jpeg")).toBe("jpg");
    expect(extensionForMime("image/webp")).toBe("webp");
  });

  it("rejects unsupported uploads", () => {
    const file = new File(["bad"], "note.txt", { type: "text/plain" });
    expect(() => assertUploadAllowed(file)).toThrow(/Only PNG/);
  });

  it("checks uploaded image bytes", () => {
    const file = new File(["not actually an image"], "fake.png", { type: "image/png" });
    expect(() => assertUploadAllowed(file, Buffer.from("not actually an image"))).toThrow(/valid PNG/);
  });

  it("accepts generated png payloads", () => {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(assertGeneratedImageAllowed(pngHeader, "image/png")).toBe("image/png");
  });
});

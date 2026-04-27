import { describe, expect, it } from "vitest";
import { assertProviderPath, normalizeProviderBaseUrl, normalizeRemoteImageUrl } from "@/lib/security/urls";

describe("remote URL safety", () => {
  it("normalizes public HTTPS provider base URLs", () => {
    expect(normalizeProviderBaseUrl("https://api.example.com/")).toBe("https://api.example.com");
  });

  it("rejects provider paths that can replace the host", () => {
    expect(() => assertProviderPath("//evil.example/v1/images", "Generation path")).toThrow(/relative API path/);
  });

  it("rejects localhost and private addresses", () => {
    expect(() => normalizeProviderBaseUrl("https://localhost")).toThrow(/localhost/);
    expect(() => normalizeRemoteImageUrl("https://10.0.0.1/image.png")).toThrow(/private/);
  });

  it("rejects non-HTTPS endpoints", () => {
    expect(() => normalizeProviderBaseUrl("http://api.example.com")).toThrow(/HTTPS/);
  });
});

import { describe, expect, it } from "vitest";
import { providerErrorDetail } from "@/lib/providers/errors";

describe("provider error details", () => {
  it("extracts nested provider messages and codes", () => {
    expect(
      providerErrorDetail(
        JSON.stringify({
          error: {
            message: "No available channel for model gpt-5 under group default",
            code: "model_not_found",
          },
        }),
      ),
    ).toBe("No available channel for model gpt-5 under group default (model_not_found)");
  });

  it("sanitizes text responses", () => {
    expect(providerErrorDetail("<html><body>failed Bearer sk-secret123</body></html>")).toBe(
      "failed Bearer ***redacted***",
    );
  });
});

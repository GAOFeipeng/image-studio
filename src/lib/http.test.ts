import { describe, expect, it } from "vitest";
import { sanitizeLogValue } from "@/lib/http";

describe("sanitizeLogValue", () => {
  it("redacts sk-style keys", () => {
    expect(sanitizeLogValue("failed with sk-testSecret123")).toBe("failed with sk-***redacted***");
  });
});

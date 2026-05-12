import { describe, expect, it, vi } from "vitest";
import { decryptSecret } from "@/lib/settings";

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

describe("provider setting secrets", () => {
  it("keeps legacy plaintext secrets readable", () => {
    expect(decryptSecret("plain-secret")).toBe("plain-secret");
  });

  it("treats undecryptable encrypted secrets as missing", () => {
    expect(decryptSecret("v1:bad:bad:bad")).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { workflowApps } from "@/lib/workflows/catalog";
import { getWorkflowDefinition, normalizeWorkflowOptions } from "@/lib/workflows/server";

describe("workflow definitions", () => {
  it("has server definitions for every catalog app", () => {
    for (const app of workflowApps) {
      const workflow = getWorkflowDefinition(app.id);
      expect(workflow.app.id).toBe(app.id);
      expect(workflow.definition.size).toBe("1024x1024");
      expect(workflow.definition.buildPrompt().length).toBeGreaterThan(100);
      expect(app.inputSlots.length).toBeGreaterThan(0);
    }
  });

  it("adds user notes to workflow prompts", () => {
    const workflow = getWorkflowDefinition("outfit-grid");
    expect(workflow.definition.buildPrompt("streetwear")).toContain("User preference: streetwear");
  });

  it("builds ecommerce prompts from reference mode and output type", () => {
    const workflow = getWorkflowDefinition("ecommerce-product");
    const prompt = workflow.definition.buildPrompt("premium nail tool", {
      referenceMode: "layout",
      outputType: "poster",
    });

    expect(prompt).toContain("layout and information hierarchy");
    expect(prompt).toContain("ecommerce advertising poster");
    expect(prompt).toContain("User preference: premium nail tool");
  });

  it("builds marketing prompts for the new marketplace apps", () => {
    const expectations = [
      ["campaign-poster", "activity campaign poster"],
      ["brand-key-visual", "brand key visual"],
      ["social-cover", "social media cover"],
      ["product-scene", "product scene image"],
      ["detail-page-hero", "product detail page lead image"],
    ] as const;

    for (const [id, keyword] of expectations) {
      const workflow = getWorkflowDefinition(id);
      expect(workflow.definition.buildPrompt("short copy")).toContain(keyword);
      expect(workflow.definition.buildPrompt("short copy")).toContain("Short copy priority");
    }
  });

  it("normalizes workflow options from catalog defaults", () => {
    expect(
      normalizeWorkflowOptions("campaign-poster", {
        campaignType: "bad",
        visualStyle: "tech",
      }),
    ).toEqual({
      campaignType: "newLaunch",
      visualStyle: "tech",
      copyTone: "direct",
    });
    expect(normalizeWorkflowOptions("outfit-grid", { campaignType: "promo" })).toEqual({});
  });

  it("rejects unknown workflows", () => {
    expect(() => getWorkflowDefinition("missing")).toThrow("Workflow not found");
  });
});

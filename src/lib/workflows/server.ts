import { HttpError } from "@/lib/http";
import { WorkflowId, WorkflowRunOptions, getWorkflowApp } from "@/lib/workflows/catalog";

type WorkflowDefinition = {
  id: WorkflowId;
  size: string;
  buildPrompt: (notes?: string | null, options?: WorkflowRunOptions) => string;
};

const shortCopyRules =
  "Short copy priority: use only a short headline, 1-4 short selling points, and an optional short CTA when text is useful. Do not create long paragraphs, dense fine print, complex parameter tables, or unreadable small text.";

const sharedMarketingSafety =
  "Do not add watermarks, UI frames, fake certification marks, fake platform badges, unrelated logos, copied contact details, or claims that are not implied by the user notes or product image.";

const workflowDefinitions: Record<WorkflowId, WorkflowDefinition> = {
  "outfit-grid": {
    id: "outfit-grid",
    size: "1024x1024",
    buildPrompt: (notes) =>
      [
        "Use the uploaded person photo as the identity reference.",
        "Create one finished square image arranged as a clean 3x3 grid.",
        "Each grid cell must show the same person with the same face, age, body proportions, and natural photo realism.",
        "Change only the outfit, styling, and matching accessories in each cell.",
        "Make nine clearly different complete outfits across casual, business, streetwear, date night, outdoor, minimalist, luxury, sporty, and seasonal styles.",
        "Keep skin tone, facial features, pose readability, and background consistency natural.",
        "Do not add text, labels, watermarks, logos, UI frames, or captions.",
        notes ? `User preference: ${notes.trim()}` : "",
      ]
        .filter(Boolean)
        .join(" "),
  },
  "hairstyle-grid": {
    id: "hairstyle-grid",
    size: "1024x1024",
    buildPrompt: (notes) =>
      [
        "Use the uploaded person photo as the identity reference.",
        "Create one finished square image arranged as a clean 3x3 grid.",
        "Each grid cell must show the same person with the same face, age, body proportions, and natural photo realism.",
        "Change only the hairstyle and subtle hair color or texture where appropriate.",
        "Make nine clearly different hairstyles across short, medium, long, layered, curly, straight, bangs, business, and fashion-forward looks.",
        "Keep facial features, skin tone, expression, clothing, and background consistent unless a hairstyle naturally requires minor styling changes.",
        "Do not add text, labels, watermarks, logos, UI frames, or captions.",
        notes ? `User preference: ${notes.trim()}` : "",
      ]
        .filter(Boolean)
        .join(" "),
  },
  "ecommerce-product": {
    id: "ecommerce-product",
    size: "1024x1024",
    buildPrompt: (notes, options) =>
      [
        "The first uploaded image is the target reference image. Every remaining uploaded image is the user's product reference.",
        "Preserve the user's product category, shape, proportions, color, material, surface details, controls, screen/display details, cable/accessory relationships, packaging details, and visible branding as accurately as possible.",
        ecommerceReferenceModePrompt(options?.referenceMode),
        ecommerceOutputTypePrompt(options?.outputType),
        "Replace any reference product with the user's product. Do not copy the reference product, reference brand, reference contact details, unrelated logos, fake certification marks, watermarks, or UI frames.",
        "If the product reference is an in-use photo, keep product accuracy first. Include hands or usage context only when it supports the selected output type and still keeps the product clear.",
        "If there are two product images, include both user products as a coherent set without inventing extra products.",
        "The result should feel commercially designed, product-first, and ready for ecommerce use.",
        notes ? `User preference: ${notes.trim()}` : "",
      ]
        .filter(Boolean)
        .join(" "),
  },
  "campaign-poster": {
    id: "campaign-poster",
    size: "1024x1024",
    buildPrompt: (notes, options) =>
      marketingPrompt([
        "Create one square activity campaign poster from the uploaded product or brand assets. If an optional reference image is uploaded, use it only as style, layout, or campaign mood guidance.",
        campaignTypePrompt(options?.campaignType),
        visualStylePrompt(options?.visualStyle),
        copyTonePrompt(options?.copyTone),
        "The poster should have a clear product or brand hero, strong title hierarchy, concise benefit areas, and a polished ecommerce or social campaign feel.",
        shortCopyRules,
        sharedMarketingSafety,
        notes ? `User preference: ${notes.trim()}` : "",
      ]),
  },
  "brand-key-visual": {
    id: "brand-key-visual",
    size: "1024x1024",
    buildPrompt: (notes, options) =>
      marketingPrompt([
        "Create one square brand key visual from the uploaded brand, product, logo, or main visual assets. If an optional reference image is uploaded, use it as style and layout inspiration without copying its brand or product.",
        kvUsePrompt(options?.kvUse),
        brandMoodPrompt(options?.brandMood),
        layoutDensityPrompt(options?.layoutDensity),
        "The result should feel like a cohesive brand KV with a memorable central visual, brand-level polish, and enough clean space for short campaign copy.",
        shortCopyRules,
        sharedMarketingSafety,
        notes ? `User preference: ${notes.trim()}` : "",
      ]),
  },
  "social-cover": {
    id: "social-cover",
    size: "1024x1024",
    buildPrompt: (notes, options) =>
      marketingPrompt([
        "Create one square social media cover from the uploaded subject assets. If an optional reference image is uploaded, use it as visual direction without copying unrelated identity or text.",
        platformPrompt(options?.platform),
        coverGoalPrompt(options?.coverGoal),
        coverStylePrompt(options?.coverStyle),
        "The cover must be immediately readable at small size, with a strong subject, clear short headline area, and platform-appropriate visual rhythm.",
        shortCopyRules,
        sharedMarketingSafety,
        notes ? `User preference: ${notes.trim()}` : "",
      ]),
  },
  "product-scene": {
    id: "product-scene",
    size: "1024x1024",
    buildPrompt: (notes, options) =>
      marketingPrompt([
        "Create one square product scene image. The uploaded product images appear first; if an optional scene reference image is uploaded, it appears after them.",
        "Preserve the user's product shape, proportions, material, color, controls, packaging, and visible branding as accurately as possible.",
        sceneTypePrompt(options?.sceneType),
        ecommerceReferenceModePrompt(options?.referenceMode),
        sceneMoodPrompt(options?.sceneMood),
        "Keep the product as the clear hero subject in a believable commercial scene. Avoid poster-like text blocks unless the user explicitly asks for them.",
        shortCopyRules,
        sharedMarketingSafety,
        notes ? `User preference: ${notes.trim()}` : "",
      ]),
  },
  "detail-page-hero": {
    id: "detail-page-hero",
    size: "1024x1024",
    buildPrompt: (notes, options) =>
      marketingPrompt([
        "Create one square product detail page lead image. The uploaded product images appear first; if an optional reference image is uploaded, it appears after them.",
        "Preserve the user's product identity, shape, proportions, material, color, controls, packaging, and visible branding as accurately as possible.",
        detailFocusPrompt(options?.detailFocus),
        layoutStylePrompt(options?.layoutStyle),
        copyDensityPrompt(options?.copyDensity),
        "The composition should feel like the first screen of a product detail page: product hero, short title, concise benefit zones, and clean commercial hierarchy.",
        shortCopyRules,
        sharedMarketingSafety,
        notes ? `User preference: ${notes.trim()}` : "",
      ]),
  },
};

export function getWorkflowDefinition(id: string) {
  const app = getWorkflowApp(id);
  if (!app) {
    throw new HttpError(404, "Workflow not found", "workflow_not_found");
  }

  return {
    app,
    definition: workflowDefinitions[app.id],
  };
}

export function normalizeWorkflowOptions(id: WorkflowId, options: WorkflowRunOptions = {}): WorkflowRunOptions {
  const app = getWorkflowApp(id);
  if (!app?.optionGroups?.length) {
    return {};
  }

  return Object.fromEntries(
    app.optionGroups.map((group) => {
      const fallback = group.defaultChoiceId ?? group.choices[0]?.id ?? "";
      return [group.id, normalizeChoice(options[group.id], group.choices.map((choice) => choice.id), fallback)];
    }),
  );
}

function normalizeChoice<T extends string>(value: string | undefined, allowed: T[], fallback: T) {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function marketingPrompt(parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function ecommerceReferenceModePrompt(mode: string | undefined) {
  switch (mode) {
    case "layout":
      return [
        "Use the reference image mainly as a layout and information hierarchy reference.",
        "Borrow its headline area, product placement, feature icon row, benefit callouts, decorative zones, CTA/banner zones, spacing, and overall poster structure when present.",
        "Do not merely copy its lighting or scene; transfer the layout logic to the user's product.",
      ].join(" ");
    case "photoStyle":
      return [
        "Use the reference image mainly as a photographic style reference.",
        "Borrow its lighting direction, color palette, contrast, material rendering, lens feel, depth of field, retouching style, and commercial polish.",
        "Do not copy its text blocks, CTA areas, icon rows, or poster layout unless the selected output type explicitly needs them.",
      ].join(" ");
    case "scene":
      return [
        "Use the reference image mainly as a scene and prop reference.",
        "Borrow its background type, surface, props, hands or usage context, decor, atmosphere, and environmental storytelling.",
        "Do not force poster text or dense graphic sections unless the selected output type explicitly needs them.",
      ].join(" ");
    case "composition":
      return [
        "Use the reference image mainly as a composition and camera reference.",
        "Borrow its product angle, crop, scale, perspective, negative space, foreground/background balance, and visual rhythm.",
        "Do not copy its text, scene props, or full layout unless they are necessary for the selected output type.",
      ].join(" ");
    case "smart":
    default:
      return [
        "Analyze the reference image and decide whether it is most useful as a layout, photographic style, scene/prop, or composition reference.",
        "Borrow only the parts that improve the selected ecommerce output type.",
        "If the reference is a poster, preserve its information hierarchy; if it is a lifestyle photo, preserve its scene/style; if it is a simple product shot, preserve its composition and lighting.",
      ].join(" ");
  }
}

function ecommerceOutputTypePrompt(type: string | undefined) {
  switch (type) {
    case "lifestyle":
      return [
        "Output type: lifestyle scene image.",
        "Create a natural ecommerce lifestyle image where the product is clearly visible in a believable use environment.",
        "Avoid dense text, icon rows, price tags, and poster-like callout blocks.",
      ].join(" ");
    case "poster":
      return [
        "Output type: ecommerce advertising poster.",
        "Create a complete square ad image with strong visual hierarchy, product hero area, concise headline space, optional feature/benefit areas, and a polished campaign feel.",
        "If generating text, keep it short and relevant; avoid dense unreadable copy.",
      ].join(" ");
    case "detailLead":
      return [
        "Output type: product detail page lead image.",
        "Create a polished first-screen detail image with product hero, concise feature explanation zones, and richer information than a simple main image while keeping the design clean.",
        "Use short readable copy only when it improves the layout; avoid clutter.",
      ].join(" ");
    case "hero":
    default:
      return [
        "Output type: ecommerce product hero image.",
        "Create a clean product-first image suitable for marketplace listing covers or paid ads.",
        "Keep the product as the dominant subject with minimal supporting copy and no clutter.",
      ].join(" ");
  }
}

function campaignTypePrompt(type: string | undefined) {
  switch (type) {
    case "promo":
      return "Campaign type: promotional poster. Emphasize limited-time value, product benefit, and a clear short CTA without dense discount terms.";
    case "festival":
      return "Campaign type: seasonal or festival poster. Use festive mood, gifting cues, and concise occasion-based copy.";
    case "live":
      return "Campaign type: livestream announcement. Make it feel like a polished live commerce preview with a strong opening-time or watch-now CTA area.";
    case "newLaunch":
    default:
      return "Campaign type: new product launch. Emphasize freshness, hero product reveal, and 1-3 crisp launch selling points.";
  }
}

function visualStylePrompt(style: string | undefined) {
  switch (style) {
    case "playful":
      return "Visual style: playful and eye-catching, with stronger color, energetic shapes, and social-friendly impact.";
    case "tech":
      return "Visual style: technology-forward, functional, precise, and modern.";
    case "minimal":
      return "Visual style: minimal, clean, spacious, and focused on the subject and headline.";
    case "premium":
    default:
      return "Visual style: premium, refined, restrained, and commercially polished.";
  }
}

function copyTonePrompt(tone: string | undefined) {
  switch (tone) {
    case "brand":
      return "Copy tone: brand-led, more like a concise campaign slogan than hard selling.";
    case "emotional":
      return "Copy tone: emotional seeding, with lifestyle imagination and softer benefit language.";
    case "urgent":
      return "Copy tone: conversion-oriented, with concise urgency and a short action phrase.";
    case "direct":
    default:
      return "Copy tone: direct selling points, using a short headline and clear benefit bullets.";
  }
}

function kvUsePrompt(use: string | undefined) {
  switch (use) {
    case "event":
      return "KV use: campaign or event key visual. Build a strong event theme, memorable central motif, and short campaign headline.";
    case "website":
      return "KV use: website hero visual. Keep hierarchy clean, modern, and suitable for a landing-page first viewport.";
    case "brand":
    default:
      return "KV use: brand key visual. Emphasize brand tone, recognition, and a polished visual system.";
  }
}

function brandMoodPrompt(mood: string | undefined) {
  switch (mood) {
    case "young":
      return "Brand mood: young, fresh, vivid, and trend-aware.";
    case "tech":
      return "Brand mood: technical, rational, futuristic, and capability-focused.";
    case "natural":
      return "Brand mood: natural, warm, approachable, and lifestyle-friendly.";
    case "premium":
    default:
      return "Brand mood: premium, refined, confident, and high-trust.";
  }
}

function layoutDensityPrompt(density: string | undefined) {
  switch (density) {
    case "clean":
      return "Layout density: clean and spacious, with strong negative space for future copy.";
    case "impact":
      return "Layout density: high impact, with larger subject scale and stronger visual memory.";
    case "balanced":
    default:
      return "Layout density: balanced, with subject, short copy, and atmosphere working together.";
  }
}

function platformPrompt(platform: string | undefined) {
  switch (platform) {
    case "douyin":
      return "Platform: Douyin cover. Use strong contrast, large subject, bold short headline, and fast-scroll stopping power.";
    case "wechat":
      return "Platform: WeChat article cover. Make the information hierarchy clear, editorial, and readable.";
    case "instagram":
      return "Platform: Instagram cover. Prioritize aesthetics, mood, color harmony, and visual consistency.";
    case "xiaohongshu":
    default:
      return "Platform: Xiaohongshu cover. Make it seedable, clickable, bright, and title-forward without clutter.";
  }
}

function coverGoalPrompt(goal: string | undefined) {
  switch (goal) {
    case "save":
      return "Cover goal: encourage saves, like a helpful list, recommendation, tutorial, or checklist cover.";
    case "brand":
      return "Cover goal: brand exposure, with calmer hierarchy and stronger identity recognition.";
    case "product":
      return "Cover goal: product conversion, with the product and one clear benefit as the focus.";
    case "click":
    default:
      return "Cover goal: increase clicks, with a clear subject and direct short headline.";
  }
}

function coverStylePrompt(style: string | undefined) {
  switch (style) {
    case "viral":
      return "Cover style: viral and high-contrast, with bold title treatment and strong visual hooks.";
    case "editorial":
      return "Cover style: editorial and magazine-like, with refined layout and polished taste.";
    case "lifestyle":
      return "Cover style: lifestyle seeding, natural, relatable, and atmospheric.";
    case "clean":
    default:
      return "Cover style: clean and refreshing, with limited elements and a clear subject.";
  }
}

function sceneTypePrompt(type: string | undefined) {
  switch (type) {
    case "home":
      return "Scene type: home lifestyle scene. Use warm domestic context and natural use cues.";
    case "outdoor":
      return "Scene type: outdoor scene. Use natural light, travel, sport, or environmental storytelling when appropriate.";
    case "studio":
      return "Scene type: studio product photography. Keep the set clean, controlled, and material-focused.";
    case "desktop":
    default:
      return "Scene type: desktop scene. Use a believable tabletop setup suitable for tools, digital products, office items, or beauty products.";
  }
}

function sceneMoodPrompt(mood: string | undefined) {
  switch (mood) {
    case "warm":
      return "Scene mood: warm, soft, approachable, and life-like.";
    case "fresh":
      return "Scene mood: fresh, bright, lightweight, and clean.";
    case "tech":
      return "Scene mood: technical, precise, cool, and functional.";
    case "premium":
    default:
      return "Scene mood: premium, polished, restrained, and commercial.";
  }
}

function detailFocusPrompt(focus: string | undefined) {
  switch (focus) {
    case "texture":
      return "Detail focus: material and texture. Highlight craft, material quality, surface detail, and premium finishing.";
    case "usage":
      return "Detail focus: usage scenario. Explain where, how, and for whom the product is used with concise visual zones.";
    case "comparison":
      return "Detail focus: comparison advantage. Express differentiated benefits through short visual callouts without dense tables.";
    case "sellingPoints":
    default:
      return "Detail focus: core selling points. Present 2-4 clear benefits around the product hero.";
  }
}

function layoutStylePrompt(style: string | undefined) {
  switch (style) {
    case "premium":
      return "Layout style: premium large hero image with fewer words, strong product scale, and refined spacing.";
    case "tech":
      return "Layout style: technical parameter-inspired hierarchy, suitable for functional and digital products, but avoid dense tables.";
    case "soft":
      return "Layout style: soft seeding style, warmer and more lifestyle-friendly.";
    case "cleanRich":
    default:
      return "Layout style: clean but information-rich, complete without feeling crowded.";
  }
}

function copyDensityPrompt(density: string | undefined) {
  switch (density) {
    case "medium":
      return "Copy density: medium, with a short headline and 2-4 concise benefit zones.";
    case "visual":
      return "Copy density: visual-first, with minimal text and a larger product hero.";
    case "short":
    default:
      return "Copy density: short copy, the safest mode for legibility.";
  }
}

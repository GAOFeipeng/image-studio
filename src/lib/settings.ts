import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { SafeUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { assertProviderPath, normalizeProviderBaseUrl } from "@/lib/security/urls";

const providerSettingKeys = [
  "image.provider",
  "image.apiBaseUrl",
  "image.generationPath",
  "image.editPath",
  "image.apiKey",
  "image.defaultModel",
  "image.defaultSize",
  "image.defaultQuality",
] as const;

type ProviderSettingKey = (typeof providerSettingKeys)[number];

export type ImageProviderSettings = {
  provider: "openai-compatible" | "mock";
  apiBaseUrl: string;
  generationPath: string;
  editPath: string;
  apiKey?: string;
  defaultModel: string;
  defaultSize: string;
  defaultQuality: "auto" | "low" | "medium" | "high";
  hasApiKey: boolean;
  apiKeyPreview: string | null;
  source: "global" | "user";
};

export const imageProviderSettingsSchema = z.object({
  provider: z.enum(["openai-compatible", "mock"]).optional(),
  apiBaseUrl: z.string().trim().url().optional(),
  generationPath: z.string().trim().min(1).startsWith("/").optional(),
  editPath: z.string().trim().min(1).startsWith("/").optional(),
  apiKey: z.string().optional(),
  clearApiKey: z.boolean().optional(),
  defaultModel: z.string().trim().min(1).optional(),
  defaultSize: z.string().trim().min(1).optional(),
  defaultQuality: z.enum(["auto", "low", "medium", "high"]).optional(),
});

type ImageProviderSettingsInput = z.infer<typeof imageProviderSettingsSchema>;
type UserProviderSettingData = {
  provider?: string;
  apiBaseUrl?: string;
  generationPath?: string;
  editPath?: string;
  apiKey?: string | null;
  defaultModel?: string;
  defaultSize?: string;
  defaultQuality?: string;
};

const keyByField: Record<Exclude<keyof ImageProviderSettingsInput, "clearApiKey">, ProviderSettingKey> = {
  provider: "image.provider",
  apiBaseUrl: "image.apiBaseUrl",
  generationPath: "image.generationPath",
  editPath: "image.editPath",
  apiKey: "image.apiKey",
  defaultModel: "image.defaultModel",
  defaultSize: "image.defaultSize",
  defaultQuality: "image.defaultQuality",
};

export async function getImageProviderSettings(user?: SafeUser): Promise<ImageProviderSettings> {
  const globalSettings = await getGlobalImageProviderSettings();
  if (!user) {
    return globalSettings;
  }

  return getUserImageProviderSettings(user, globalSettings);
}

async function getGlobalImageProviderSettings(): Promise<ImageProviderSettings> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: [...providerSettingKeys] } },
  });
  const values = new Map(rows.map((row) => [row.key, row]));
  const encryptedApiKey = values.get("image.apiKey")?.value ?? undefined;
  const apiKey = encryptedApiKey ? decryptSecret(encryptedApiKey) : env.IMAGE_API_KEY;
  const provider = parseProvider(values.get("image.provider")?.value ?? env.IMAGE_PROVIDER);

  return {
    provider,
    apiBaseUrl: values.get("image.apiBaseUrl")?.value || env.IMAGE_API_BASE_URL,
    generationPath: values.get("image.generationPath")?.value || env.IMAGE_GENERATION_PATH,
    editPath: values.get("image.editPath")?.value || env.IMAGE_EDIT_PATH,
    apiKey,
    defaultModel: values.get("image.defaultModel")?.value || env.IMAGE_DEFAULT_MODEL,
    defaultSize: values.get("image.defaultSize")?.value || env.IMAGE_DEFAULT_SIZE,
    defaultQuality: parseQuality(values.get("image.defaultQuality")?.value ?? env.IMAGE_DEFAULT_QUALITY),
    hasApiKey: Boolean(apiKey && apiKey !== "server-only-secret"),
    apiKeyPreview: apiKey ? maskSecret(apiKey) : null,
    source: "global",
  };
}

async function getUserImageProviderSettings(
  user: SafeUser,
  globalSettings: ImageProviderSettings,
): Promise<ImageProviderSettings> {
  const row = await prisma.userProviderSetting.findUnique({
    where: { userId: user.id },
  });
  const apiKey = row?.apiKey ? decryptSecret(row.apiKey) : undefined;

  return {
    provider: parseProvider(row?.provider ?? globalSettings.provider),
    apiBaseUrl: row?.apiBaseUrl || globalSettings.apiBaseUrl,
    generationPath: row?.generationPath || globalSettings.generationPath,
    editPath: row?.editPath || globalSettings.editPath,
    apiKey,
    defaultModel: row?.defaultModel || globalSettings.defaultModel,
    defaultSize: row?.defaultSize || globalSettings.defaultSize,
    defaultQuality: parseQuality(row?.defaultQuality ?? globalSettings.defaultQuality),
    hasApiKey: Boolean(apiKey && apiKey !== "server-only-secret"),
    apiKeyPreview: apiKey ? maskSecret(apiKey) : null,
    source: "user",
  };
}

export async function updateImageProviderSettings(input: ImageProviderSettingsInput, actor: SafeUser) {
  const data = imageProviderSettingsSchema.parse(input);
  const updates: Array<ReturnType<typeof prisma.appSetting.upsert>> = [];

  if (data.provider !== undefined) {
    updates.push(upsertSetting("image.provider", data.provider, false));
  }

  if (data.apiBaseUrl !== undefined) {
    updates.push(upsertSetting("image.apiBaseUrl", normalizeProviderBaseUrl(data.apiBaseUrl), false));
  }

  if (data.generationPath !== undefined) {
    updates.push(
      upsertSetting("image.generationPath", assertProviderPath(data.generationPath.trim(), "Generation path"), false),
    );
  }

  if (data.editPath !== undefined) {
    updates.push(upsertSetting("image.editPath", assertProviderPath(data.editPath.trim(), "Edit path"), false));
  }

  for (const field of ["defaultModel", "defaultSize", "defaultQuality"] as const) {
    if (data[field] !== undefined) {
      updates.push(upsertSetting(keyByField[field], data[field].trim(), false));
    }
  }

  if (data.clearApiKey) {
    updates.push(upsertSetting("image.apiKey", null, true));
  } else if (data.apiKey !== undefined && data.apiKey.trim()) {
    updates.push(upsertSetting("image.apiKey", encryptSecret(data.apiKey.trim()), true));
  }

  await Promise.all(updates);
  await prisma.auditLog.create({
    data: {
      actorUserId: actor.id,
      action: "admin.provider_settings.update",
      targetType: "AppSetting",
      metadata: {
        fields: Object.entries(data)
          .filter(([key, value]) => key !== "apiKey" && value !== undefined)
          .map(([key]) => key),
        apiKeyChanged: Boolean(data.clearApiKey || data.apiKey?.trim()),
      },
    },
  });

  return getPublicImageProviderSettings();
}

export async function updateUserImageProviderSettings(input: ImageProviderSettingsInput, actor: SafeUser) {
  const data = imageProviderSettingsSchema.parse(input);
  const updateData = buildUserProviderSettingData(data);

  await prisma.userProviderSetting.upsert({
    where: { userId: actor.id },
    create: {
      userId: actor.id,
      ...updateData,
    },
    update: updateData,
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: actor.id,
      action: "user.provider_settings.update",
      targetType: "UserProviderSetting",
      targetId: actor.id,
      metadata: {
        fields: Object.entries(data)
          .filter(([key, value]) => key !== "apiKey" && value !== undefined)
          .map(([key]) => key),
        apiKeyChanged: Boolean(data.clearApiKey || data.apiKey?.trim()),
      },
    },
  });

  return getPublicImageProviderSettings(actor);
}

export async function getPublicImageProviderSettings(user?: SafeUser) {
  const settings = await getImageProviderSettings(user);
  return {
    provider: settings.provider,
    apiBaseUrl: settings.apiBaseUrl,
    generationPath: settings.generationPath,
    editPath: settings.editPath,
    defaultModel: settings.defaultModel,
    defaultSize: settings.defaultSize,
    defaultQuality: settings.defaultQuality,
    hasApiKey: settings.hasApiKey,
    apiKeyPreview: settings.apiKeyPreview,
    source: settings.source,
  };
}

export async function applyImageParamDefaults<
  T extends { model?: string; size?: string; quality?: "auto" | "low" | "medium" | "high"; n?: number },
>(
  params: T,
  user?: SafeUser,
) {
  const settings = await getImageProviderSettings(user);
  return {
    ...params,
    model: params.model ?? settings.defaultModel,
    size: params.size ?? settings.defaultSize,
    quality: params.quality ?? settings.defaultQuality,
    n: params.n ?? 1,
  };
}

function upsertSetting(key: ProviderSettingKey, value: string | null, encrypted: boolean) {
  return prisma.appSetting.upsert({
    where: { key },
    create: { key, value, encrypted },
    update: { value, encrypted },
  });
}

function buildUserProviderSettingData(data: ImageProviderSettingsInput) {
  const updateData: UserProviderSettingData = {};

  if (data.provider !== undefined) {
    updateData.provider = data.provider;
  }

  if (data.apiBaseUrl !== undefined) {
    updateData.apiBaseUrl = normalizeProviderBaseUrl(data.apiBaseUrl);
  }

  if (data.generationPath !== undefined) {
    updateData.generationPath = assertProviderPath(data.generationPath.trim(), "Generation path");
  }

  if (data.editPath !== undefined) {
    updateData.editPath = assertProviderPath(data.editPath.trim(), "Edit path");
  }

  if (data.defaultModel !== undefined) {
    updateData.defaultModel = data.defaultModel.trim();
  }

  if (data.defaultSize !== undefined) {
    updateData.defaultSize = data.defaultSize.trim();
  }

  if (data.defaultQuality !== undefined) {
    updateData.defaultQuality = data.defaultQuality;
  }

  if (data.clearApiKey) {
    updateData.apiKey = null;
  } else if (data.apiKey !== undefined && data.apiKey.trim()) {
    updateData.apiKey = encryptSecret(data.apiKey.trim());
  }

  return updateData;
}

function parseProvider(value: string) {
  return value === "mock" ? "mock" : "openai-compatible";
}

function parseQuality(value: string) {
  return value === "low" || value === "medium" || value === "high" || value === "auto" ? value : "auto";
}

function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

function decryptSecret(value: string) {
  const [version, iv, tag, ciphertext] = value.split(":");
  if (version !== "v1" || !iv || !tag || !ciphertext) {
    return value;
  }

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function encryptionKey() {
  if (process.env.NODE_ENV === "production" && !env.SETTINGS_ENCRYPTION_KEY) {
    throw new HttpError(500, "SETTINGS_ENCRYPTION_KEY is required in production", "settings_key_not_configured");
  }

  return createHash("sha256")
    .update(env.SETTINGS_ENCRYPTION_KEY ?? env.JWT_SECRET)
    .digest();
}

function maskSecret(value: string) {
  if (value.length <= 4) {
    return "****";
  }

  return `****${value.slice(-4)}`;
}

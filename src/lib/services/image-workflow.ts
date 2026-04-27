import {
  AssetKind,
  AssetSource,
  Prisma,
  Role,
  TurnStatus,
  TurnType,
  UsageAction,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { HttpError } from "@/lib/http";
import { writeAuditLog } from "@/lib/audit";
import {
  assertGeneratedImageAllowed,
  assertUploadAllowed,
  extensionForMime,
  normalizeMimeType,
} from "@/lib/images/validation";
import { getImageProvider } from "@/lib/providers";
import { ProviderImage } from "@/lib/providers/types";
import { prisma } from "@/lib/prisma";
import { normalizeRemoteImageUrl } from "@/lib/security/urls";
import { assetFileUrl, readBuffer, saveBuffer } from "@/lib/storage/local";
import { SafeUser } from "@/lib/auth";
import { env } from "@/lib/env";

type ImageParams = {
  model: string;
  size?: string;
  quality?: "low" | "medium" | "high" | "auto";
  background?: "transparent" | "opaque" | "auto";
  n?: number;
  seed?: number;
};

export function serializeAsset<T extends { id: string }>(asset: T) {
  return { ...asset, url: assetFileUrl(asset.id) };
}

export function serializeTurn<T extends { outputAssetIds: Prisma.JsonValue | null }>(turn: T) {
  return {
    ...turn,
    outputAssetIds: Array.isArray(turn.outputAssetIds) ? turn.outputAssetIds : [],
  };
}

export async function getAccessibleSession(user: SafeUser, sessionId: string) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });

  if (!session) {
    throw new HttpError(404, "Session not found", "session_not_found");
  }

  if (user.role !== Role.ADMIN && session.ownerId !== user.id) {
    throw new HttpError(403, "You cannot access this session", "forbidden");
  }

  return session;
}

export async function listSessions(user: SafeUser) {
  return prisma.session.findMany({
    where: user.role === Role.ADMIN ? undefined : { ownerId: user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { turns: true, assets: true } },
    },
  });
}

export async function createSession(user: SafeUser, title?: string) {
  return prisma.session.create({
    data: {
      title: title || "未命名创作",
      ownerId: user.id,
      defaultParams: {},
    },
  });
}

export async function listSessionAssets(user: SafeUser, sessionId: string) {
  await getAccessibleSession(user, sessionId);

  const assets = await prisma.asset.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
  });

  return assets.map(serializeAsset);
}

export async function listSessionTurns(user: SafeUser, sessionId: string) {
  await getAccessibleSession(user, sessionId);

  const turns = await prisma.turn.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });

  return turns.map(serializeTurn);
}

export async function uploadSessionAsset(options: {
  user: SafeUser;
  sessionId: string;
  file: File;
  kind: AssetKind;
}) {
  const session = await getAccessibleSession(options.user, options.sessionId);
  const buffer = Buffer.from(await options.file.arrayBuffer());
  const id = randomUUID();
  const mimeType = assertUploadAllowed(options.file, buffer);
  const extension = extensionForMime(mimeType);
  const storageKey = `${options.user.id}/${id}.${extension}`;

  await saveBuffer(storageKey, buffer);

  const asset = await prisma.asset.create({
    data: {
      id,
      ownerId: session.ownerId,
      sessionId: session.id,
      kind: options.kind,
      source: AssetSource.UPLOAD,
      mimeType,
      sizeBytes: buffer.byteLength,
      storageKey,
      originalFilename: options.file.name,
    },
  });

  await prisma.usageEvent.create({
    data: {
      userId: options.user.id,
      action: UsageAction.UPLOAD,
      assetCount: 1,
    },
  });

  return serializeAsset(asset);
}

export async function runGeneration(options: {
  user: SafeUser;
  sessionId: string;
  prompt: string;
  params: ImageParams;
  parentTurnId?: string | null;
  retryOfTurnId?: string | null;
  attempt?: number;
}) {
  const session = await getAccessibleSession(options.user, options.sessionId);
  const provider = await getImageProvider();
  const turn = await prisma.turn.create({
    data: {
      sessionId: session.id,
      userId: options.user.id,
      type: TurnType.GENERATION,
      status: TurnStatus.QUEUED,
      prompt: options.prompt,
      params: options.params,
      provider: provider.name,
      providerModel: options.params.model,
      parentTurnId: options.parentTurnId ?? undefined,
      retryOfTurnId: options.retryOfTurnId ?? undefined,
      attempt: options.attempt ?? 1,
    },
  });
  await writeAuditLog({
    actor: options.user,
    action: "task.created",
    targetType: "Turn",
    targetId: turn.id,
    metadata: {
      type: TurnType.GENERATION,
      sessionId: session.id,
      provider: provider.name,
      model: options.params.model,
      attempt: turn.attempt,
    },
  });

  const startedAt = new Date();
  await prisma.turn.update({
    where: { id: turn.id },
    data: { status: TurnStatus.PROCESSING, startedAt },
  });

  try {
    const result = await provider.generate({
      prompt: options.prompt,
      params: options.params,
      userId: options.user.id,
    });
    const assets = await persistProviderImages({
      images: result.images,
      userId: options.user.id,
      sessionId: session.id,
      turnId: turn.id,
      source: AssetSource.GENERATION,
    });
    const latencyMs = Date.now() - startedAt.getTime();
    const updatedTurn = await prisma.turn.update({
      where: { id: turn.id },
      data: {
        status: TurnStatus.SUCCEEDED,
        requestId: result.requestId,
        revisedPrompt: result.revisedPrompt,
        outputAssetIds: assets.map((asset) => asset.id),
        latencyMs,
        completedAt: new Date(),
      },
    });

    await writeUsage({
      userId: options.user.id,
      action: UsageAction.GENERATION,
      status: TurnStatus.SUCCEEDED,
      model: options.params.model,
      turnId: turn.id,
      latencyMs,
      assetCount: assets.length,
    });
    await writeAuditLog({
      actor: options.user,
      action: "task.succeeded",
      targetType: "Turn",
      targetId: turn.id,
      metadata: {
        type: TurnType.GENERATION,
        sessionId: session.id,
        provider: provider.name,
        model: options.params.model,
        latencyMs,
        assetCount: assets.length,
        requestId: result.requestId,
      },
    });

    await prisma.session.update({
      where: { id: session.id },
      data: { updatedAt: new Date() },
    });

    return {
      turn: serializeTurn(updatedTurn),
      assets: assets.map(serializeAsset),
    };
  } catch (error) {
    await markTurnFailed({
      turnId: turn.id,
      userId: options.user.id,
      action: UsageAction.GENERATION,
      model: options.params.model,
      provider: provider.name,
      startedAt,
      error,
      actor: options.user,
      sessionId: session.id,
      type: TurnType.GENERATION,
    });
    throw error;
  }
}

export async function runEdit(options: {
  user: SafeUser;
  sessionId: string;
  prompt: string;
  params: ImageParams;
  inputAssetIds: string[];
  maskAssetId?: string | null;
  parentTurnId?: string | null;
  retryOfTurnId?: string | null;
  attempt?: number;
}) {
  const session = await getAccessibleSession(options.user, options.sessionId);
  const provider = await getImageProvider();
  const inputAssets = await prisma.asset.findMany({
    where: { id: { in: options.inputAssetIds }, sessionId: session.id },
  });

  if (inputAssets.length !== options.inputAssetIds.length) {
    throw new HttpError(400, "One or more input assets are invalid", "invalid_input_asset");
  }
  const inputAssetById = new Map(inputAssets.map((asset) => [asset.id, asset]));
  const orderedInputAssets = options.inputAssetIds.map((assetId) => inputAssetById.get(assetId)!);

  const maskAsset = options.maskAssetId
    ? await prisma.asset.findFirst({ where: { id: options.maskAssetId, sessionId: session.id } })
    : null;

  if (options.maskAssetId && !maskAsset) {
    throw new HttpError(400, "Mask asset is invalid", "invalid_mask_asset");
  }

  const turn = await prisma.turn.create({
    data: {
      sessionId: session.id,
      userId: options.user.id,
      type: TurnType.EDIT,
      status: TurnStatus.QUEUED,
      prompt: options.prompt,
      params: options.params,
      inputAssetIds: options.inputAssetIds,
      maskAssetId: options.maskAssetId ?? undefined,
      provider: provider.name,
      providerModel: options.params.model,
      parentTurnId: options.parentTurnId ?? undefined,
      retryOfTurnId: options.retryOfTurnId ?? undefined,
      attempt: options.attempt ?? 1,
    },
  });
  await writeAuditLog({
    actor: options.user,
    action: "task.created",
    targetType: "Turn",
    targetId: turn.id,
    metadata: {
      type: TurnType.EDIT,
      sessionId: session.id,
      provider: provider.name,
      model: options.params.model,
      attempt: turn.attempt,
      inputAssetCount: options.inputAssetIds.length,
    },
  });

  const startedAt = new Date();
  await prisma.turn.update({
    where: { id: turn.id },
    data: { status: TurnStatus.PROCESSING, startedAt },
  });

  try {
    const editableImages = await Promise.all(
      orderedInputAssets.map(async (asset) => ({
        buffer: await readBuffer(asset.storageKey),
        filename: asset.originalFilename ?? `${asset.id}.${extensionForMime(asset.mimeType)}`,
        mimeType: asset.mimeType,
      })),
    );
    const editableMask = maskAsset
      ? {
          buffer: await readBuffer(maskAsset.storageKey),
          filename: maskAsset.originalFilename ?? `${maskAsset.id}.${extensionForMime(maskAsset.mimeType)}`,
          mimeType: maskAsset.mimeType,
        }
      : undefined;

    const result = await provider.edit({
      prompt: options.prompt,
      params: options.params,
      userId: options.user.id,
      images: editableImages,
      mask: editableMask,
    });
    const assets = await persistProviderImages({
      images: result.images,
      userId: options.user.id,
      sessionId: session.id,
      turnId: turn.id,
      source: AssetSource.EDIT,
      parentAssetId: options.inputAssetIds[0],
    });
    const latencyMs = Date.now() - startedAt.getTime();
    const updatedTurn = await prisma.turn.update({
      where: { id: turn.id },
      data: {
        status: TurnStatus.SUCCEEDED,
        requestId: result.requestId,
        revisedPrompt: result.revisedPrompt,
        outputAssetIds: assets.map((asset) => asset.id),
        latencyMs,
        completedAt: new Date(),
      },
    });

    await writeUsage({
      userId: options.user.id,
      action: UsageAction.EDIT,
      status: TurnStatus.SUCCEEDED,
      model: options.params.model,
      turnId: turn.id,
      latencyMs,
      assetCount: assets.length,
    });
    await writeAuditLog({
      actor: options.user,
      action: "task.succeeded",
      targetType: "Turn",
      targetId: turn.id,
      metadata: {
        type: TurnType.EDIT,
        sessionId: session.id,
        provider: provider.name,
        model: options.params.model,
        latencyMs,
        assetCount: assets.length,
        requestId: result.requestId,
      },
    });

    await prisma.session.update({
      where: { id: session.id },
      data: { updatedAt: new Date() },
    });

    return {
      turn: serializeTurn(updatedTurn),
      assets: assets.map(serializeAsset),
    };
  } catch (error) {
    await markTurnFailed({
      turnId: turn.id,
      userId: options.user.id,
      action: UsageAction.EDIT,
      model: options.params.model,
      provider: provider.name,
      startedAt,
      error,
      actor: options.user,
      sessionId: session.id,
      type: TurnType.EDIT,
    });
    throw error;
  }
}

async function persistProviderImages(options: {
  images: ProviderImage[];
  userId: string;
  sessionId: string;
  turnId: string;
  source: AssetSource;
  parentAssetId?: string;
}) {
  const assets = [];

  for (const image of options.images) {
    const { buffer, mimeType } = await resolveProviderImage(image);
    const id = randomUUID();
    const extension = extensionForMime(mimeType);
    const storageKey = `${options.userId}/${id}.${extension}`;

    await saveBuffer(storageKey, buffer);

    assets.push(
      await prisma.asset.create({
        data: {
          id,
          ownerId: options.userId,
          sessionId: options.sessionId,
          kind: AssetKind.OUTPUT,
          source: options.source,
          mimeType,
          sizeBytes: buffer.byteLength,
          storageKey,
          createdByTurnId: options.turnId,
          parentAssetId: options.parentAssetId,
          metadata: image.revisedPrompt ? { revisedPrompt: image.revisedPrompt } : undefined,
        },
      }),
    );
  }

  return assets;
}

async function resolveProviderImage(image: ProviderImage) {
  if (image.b64Json) {
    const buffer = Buffer.from(image.b64Json, "base64");
    const mimeType = assertGeneratedImageAllowed(buffer, image.mimeType ?? "image/png");
    return {
      buffer,
      mimeType,
    };
  }

  if (image.url) {
    const response = await fetchWithTimeout(normalizeRemoteImageUrl(image.url));
    if (!response.ok) {
      throw new HttpError(502, "Could not download generated image", "image_download_failed");
    }
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    const maxBytes = env.MAX_UPLOAD_MB * 1024 * 1024;
    if (contentLength > maxBytes) {
      throw new HttpError(502, `Generated image is larger than ${env.MAX_UPLOAD_MB} MB`, "generated_image_too_large");
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const declaredMimeType = normalizeMimeType(response.headers.get("content-type")) ?? image.mimeType;
    const mimeType = assertGeneratedImageAllowed(buffer, declaredMimeType);

    return {
      buffer,
      mimeType,
    };
  }

  throw new HttpError(502, "Image provider returned an unsupported image payload", "unsupported_image_payload");
}

async function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.IMAGE_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { signal: controller.signal, redirect: "error" });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new HttpError(504, "Generated image download timed out", "image_download_timeout");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function markTurnFailed(options: {
  turnId: string;
  userId: string;
  action: UsageAction;
  model: string;
  provider: string;
  startedAt: Date;
  error: unknown;
  actor: SafeUser;
  sessionId: string;
  type: TurnType;
}) {
  const latencyMs = Date.now() - options.startedAt.getTime();
  const error = options.error;
  const code = error instanceof HttpError ? error.code : "unknown_error";
  const status = error instanceof HttpError ? error.status : undefined;
  const message = safeTaskErrorMessage(error);

  await prisma.turn.update({
    where: { id: options.turnId },
    data: {
      status: TurnStatus.FAILED,
      errorCode: code,
      errorStatus: status,
      errorMessage: message.slice(0, 1000),
      latencyMs,
      completedAt: new Date(),
    },
  });

  await writeUsage({
    userId: options.userId,
    action: options.action,
    status: TurnStatus.FAILED,
    model: options.model,
    turnId: options.turnId,
    latencyMs,
    errorCode: code,
  });
  await writeAuditLog({
    actor: options.actor,
    action: "task.failed",
    targetType: "Turn",
    targetId: options.turnId,
    metadata: {
      type: options.type,
      sessionId: options.sessionId,
      provider: options.provider,
      model: options.model,
      latencyMs,
      errorCode: code,
      errorStatus: status,
      errorMessage: message.slice(0, 500),
    },
  });

  if (code.startsWith("provider_")) {
    await writeAuditLog({
      actor: options.actor,
      action: "provider.call.failed",
      targetType: "Turn",
      targetId: options.turnId,
      metadata: {
        provider: options.provider,
        model: options.model,
        latencyMs,
        errorCode: code,
        errorStatus: status,
        errorMessage: message.slice(0, 500),
      },
    });
  }
}

function safeTaskErrorMessage(error: unknown) {
  if (error instanceof HttpError && error.code.startsWith("provider_")) {
    return error.message;
  }

  if (error instanceof HttpError) {
    return error.message;
  }

  return "Internal image task error";
}

async function writeUsage(data: {
  userId: string;
  action: UsageAction;
  status?: TurnStatus;
  model?: string;
  turnId?: string;
  latencyMs?: number;
  assetCount?: number;
  errorCode?: string;
}) {
  await prisma.usageEvent.create({ data });
}

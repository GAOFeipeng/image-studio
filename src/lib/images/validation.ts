import { z } from "zod";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/http";

export const rawImageParamsSchema = z.object({
  model: z.string().min(1).optional(),
  size: z.string().min(1).optional(),
  quality: z.enum(["low", "medium", "high", "auto"]).optional(),
  background: z.enum(["transparent", "opaque", "auto"]).optional(),
  n: z.coerce.number().int().min(1).max(4).optional(),
  seed: z.coerce.number().int().optional(),
});

export const imageParamsSchema = rawImageParamsSchema.default({}).transform((params) => ({
  ...params,
  model: params.model ?? env.IMAGE_DEFAULT_MODEL,
  size: params.size ?? env.IMAGE_DEFAULT_SIZE,
  n: params.n ?? 1,
}));

export const rawGenerationSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
  params: rawImageParamsSchema.default({}),
  parentTurnId: z.string().optional().nullable(),
});

export const generationSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
  params: imageParamsSchema,
  parentTurnId: z.string().optional().nullable(),
});

export const rawEditSchema = rawGenerationSchema.extend({
  inputAssetIds: z.array(z.string().min(1)).min(1).max(4),
  maskAssetId: z.string().optional().nullable(),
});

export const editSchema = generationSchema.extend({
  inputAssetIds: z.array(z.string().min(1)).min(1).max(4),
  maskAssetId: z.string().optional().nullable(),
});

export const createSessionSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
});

export const allowedMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
export const generatedMimeTypes = new Set([...allowedMimeTypes]);

export function extensionForMime(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/svg+xml") return "svg";
  return "bin";
}

export function assertUploadAllowed(file: File, buffer?: Buffer | Uint8Array) {
  if (!allowedMimeTypes.has(file.type)) {
    throw new HttpError(400, "Only PNG, JPEG, and WebP images are supported", "unsupported_file_type");
  }

  const maxBytes = env.MAX_UPLOAD_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new HttpError(400, `Image must be ${env.MAX_UPLOAD_MB} MB or smaller`, "file_too_large");
  }

  if (buffer) {
    const mimeType = detectImageMime(buffer);
    if (!mimeType || !allowedMimeTypes.has(mimeType)) {
      throw new HttpError(400, "Uploaded file is not a valid PNG, JPEG, or WebP image", "invalid_image_file");
    }

    return mimeType;
  }

  return file.type;
}

export function assertGeneratedImageAllowed(buffer: Buffer | Uint8Array, declaredMimeType?: string | null) {
  const maxBytes = env.MAX_UPLOAD_MB * 1024 * 1024;
  if (buffer.byteLength > maxBytes) {
    throw new HttpError(502, `Generated image is larger than ${env.MAX_UPLOAD_MB} MB`, "generated_image_too_large");
  }

  const detectedMimeType = detectImageMime(buffer);
  const mimeType = detectedMimeType ?? normalizeMimeType(declaredMimeType);
  if (!mimeType || !generatedMimeTypes.has(mimeType)) {
    throw new HttpError(502, "Image provider returned an unsupported image type", "unsupported_generated_image_type");
  }

  return mimeType;
}

export function normalizeMimeType(value?: string | null) {
  return value?.split(";")[0]?.trim().toLowerCase() || null;
}

function detectImageMime(buffer: Buffer | Uint8Array) {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png";
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 12 &&
    String.fromCharCode(...buffer.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...buffer.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }

  const head = Buffer.from(buffer.slice(0, 512)).toString("utf8").trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) {
    return "image/svg+xml";
  }

  return null;
}

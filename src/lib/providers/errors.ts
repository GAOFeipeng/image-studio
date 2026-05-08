import { HttpError } from "@/lib/http";

const MAX_PROVIDER_ERROR_DETAIL_LENGTH = 500;

export async function providerHttpError(response: Response) {
  const requestId = response.headers.get("x-request-id") ?? response.headers.get("x-correlation-id");
  const requestIdSuffix = requestId ? ` request_id=${requestId}` : "";
  const statusText = response.statusText ? ` ${response.statusText}` : "";
  const detail = providerErrorDetail(await safeResponseText(response));
  const detailSuffix = detail ? `: ${detail}` : "";

  return new HttpError(
    502,
    `Image provider request failed (${response.status}${statusText})${requestIdSuffix}${detailSuffix}`,
    "provider_error",
  );
}

export function providerErrorDetail(body: string) {
  const trimmed = body.trim();
  if (!trimmed) {
    return "";
  }

  const parsed = parseJson(trimmed);
  const detail = parsed ? extractErrorDetail(parsed) : trimmed;
  return truncate(sanitizeProviderDetail(detail), MAX_PROVIDER_ERROR_DETAIL_LENGTH);
}

async function safeResponseText(response: Response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractErrorDetail(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  const object = value as Record<string, unknown>;
  const error = object.error;
  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    const errorObject = error as Record<string, unknown>;
    return withCode(stringValue(errorObject.message) || stringValue(errorObject.detail), stringValue(errorObject.code));
  }

  return withCode(stringValue(object.message) || stringValue(object.detail), stringValue(object.code));
}

function withCode(message: string, code: string) {
  if (!message) {
    return code;
  }

  if (!code || message.includes(code)) {
    return message;
  }

  return `${message} (${code})`;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function sanitizeProviderDetail(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer ***redacted***")
    .replace(/sk-[A-Za-z0-9_-]+/g, "sk-***redacted***")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

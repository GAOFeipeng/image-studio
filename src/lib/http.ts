import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "error",
  ) {
    super(message);
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(status: number, message: string, code = "error") {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function handleError(error: unknown) {
  if (error instanceof HttpError) {
    return fail(error.status, error.message, error.code);
  }

  if (error instanceof ZodError) {
    return fail(400, error.issues[0]?.message ?? "请求参数无效", "validation_error");
  }

  const prismaCode = getPrismaCode(error);
  if (prismaCode) {
    console.error(sanitizeLogValue(error));

    if (prismaCode === "P2002") {
      return fail(409, "Resource already exists", "conflict");
    }

    if (prismaCode === "P2025") {
      return fail(404, "Resource not found", "not_found");
    }

    return fail(
      503,
      "数据库未启动或尚未迁移。请先启动 PostgreSQL，并执行 Prisma 迁移。",
      "database_unavailable",
    );
  }

  console.error(sanitizeLogValue(error));
  return fail(500, "Internal server error", "internal_error");
}

export function sanitizeLogValue(value: unknown) {
  const text = value instanceof Error ? value.stack ?? value.message : String(value);
  return text.replace(/sk-[A-Za-z0-9_-]+/g, "sk-***redacted***");
}

export function getClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    undefined
  );
}

function getPrismaCode(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const maybeError = error as { code?: unknown; clientVersion?: unknown };
  if (typeof maybeError.code === "string" && typeof maybeError.clientVersion === "string") {
    return maybeError.code;
  }

  return null;
}

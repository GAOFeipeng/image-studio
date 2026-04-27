import { Role, TurnStatus, UsageAction } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createSessionToken,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";
import { env } from "@/lib/env";
import { fail, getClientIp, handleError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const loginSchema = z.object({
  email: z.string().trim().min(1, "请输入邮箱").email("请输入有效邮箱"),
  password: z.string().min(1, "请输入密码"),
});

export async function POST(request: Request) {
  try {
    const body = loginSchema.parse(await request.json());
    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    });

    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return fail(401, "Invalid email or password", "invalid_credentials");
    }

    if (user.status !== "ACTIVE") {
      return fail(403, "User is disabled", "user_disabled");
    }

    const token = await createSessionToken(user);
    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
      },
    });

    response.cookies.set(env.SESSION_COOKIE_NAME, token, sessionCookieOptions());

    await prisma.usageEvent.create({
      data: {
        userId: user.id,
        action: UsageAction.LOGIN,
        status: TurnStatus.SUCCEEDED,
      },
    });

    if (user.role === Role.ADMIN) {
      await prisma.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "auth.login",
          targetType: "User",
          targetId: user.id,
          ip: getClientIp(request),
          userAgent: request.headers.get("user-agent") ?? undefined,
        },
      });
    }

    return response;
  } catch (error) {
    return handleError(error);
  }
}

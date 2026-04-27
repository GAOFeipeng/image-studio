import { Role, TurnStatus, UsageAction, UserStatus } from "@prisma/client";
import { z } from "zod";
import { allowRegistration } from "@/lib/env";
import { createSessionToken, hashPassword, sessionCookieOptions } from "@/lib/auth";
import { env } from "@/lib/env";
import { fail, handleError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const registerSchema = z.object({
  email: z.string().trim().min(1, "请输入邮箱").email("请输入有效邮箱"),
  password: z.string().min(8, "密码至少需要 8 位"),
});

export async function POST(request: Request) {
  try {
    if (!allowRegistration()) {
      const userCount = await prisma.user.count();
      if (userCount > 0) {
        return fail(403, "Registration is disabled", "registration_disabled");
      }
    }

    const body = registerSchema.parse(await request.json());
    const userCount = await prisma.user.count();
    const isFirstUser = userCount === 0;
    const user = await prisma.user.create({
      data: {
        email: body.email.toLowerCase(),
        passwordHash: await hashPassword(body.password),
        role: isFirstUser ? Role.ADMIN : Role.USER,
        status: UserStatus.ACTIVE,
      },
    });
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
        action: UsageAction.REGISTER,
        status: TurnStatus.SUCCEEDED,
      },
    });

    if (isFirstUser) {
      await prisma.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "auth.bootstrap_admin",
          targetType: "User",
          targetId: user.id,
        },
      });
    }

    return response;
  } catch (error) {
    return handleError(error);
  }
}

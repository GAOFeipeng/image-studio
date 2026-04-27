import { Role, User, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const encoder = new TextEncoder();

type SessionToken = {
  userId: string;
  role: Role;
};

export type SafeUser = Pick<User, "id" | "email" | "role" | "status" | "createdAt">;

function secret() {
  return encoder.encode(env.JWT_SECRET);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(user: Pick<User, "id" | "role">) {
  return new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

export async function readSessionToken(): Promise<SessionToken | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(env.SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const verified = await jwtVerify(token, secret());
    const role = verified.payload.role;
    const userId = verified.payload.sub;

    if (!userId || (role !== Role.USER && role !== Role.ADMIN)) {
      return null;
    }

    return { userId, role };
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<SafeUser | null> {
  const session = await readSessionToken();

  if (!session) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, role: true, status: true, createdAt: true },
  });

  if (!user || user.status !== UserStatus.ACTIVE) {
    return null;
  }

  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new HttpError(401, "Authentication required", "unauthorized");
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireUser();

  if (user.role !== Role.ADMIN) {
    throw new HttpError(403, "Admin role required", "forbidden");
  }

  return user;
}

export function canAccessOwnerResource(user: SafeUser, ownerId: string) {
  return user.role === Role.ADMIN || user.id === ownerId;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}

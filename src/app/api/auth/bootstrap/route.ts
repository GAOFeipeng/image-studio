import { handleError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const userCount = await prisma.user.count();
    return ok({ requiresBootstrap: userCount === 0 });
  } catch (error) {
    return handleError(error);
  }
}

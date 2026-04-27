import { TurnStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { handleError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const [todayTasks, sevenDayTasks, totalUsers, recentTurns, recentUsage, failedTurns, recentTasks] = await Promise.all([
      prisma.turn.count({ where: { createdAt: { gte: today } } }),
      prisma.turn.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.user.count(),
      prisma.turn.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: {
          id: true,
          userId: true,
          type: true,
          status: true,
          providerModel: true,
          latencyMs: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.usageEvent.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { action: true, status: true, model: true, assetCount: true, createdAt: true, userId: true },
      }),
      prisma.turn.findMany({
        where: { status: TurnStatus.FAILED },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          prompt: true,
          type: true,
          providerModel: true,
          errorCode: true,
          errorMessage: true,
          errorStatus: true,
          latencyMs: true,
          createdAt: true,
          user: { select: { email: true } },
        },
      }),
      prisma.turn.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          prompt: true,
          type: true,
          status: true,
          providerModel: true,
          latencyMs: true,
          createdAt: true,
          user: { select: { email: true } },
        },
      }),
    ]);

    const sevenDayTurns = recentTurns.filter((turn) => turn.createdAt >= sevenDaysAgo);
    const completedTurns = recentTurns.filter(
      (turn) => turn.status === TurnStatus.SUCCEEDED || turn.status === TurnStatus.FAILED,
    );
    const sevenDayCompletedTurns = sevenDayTurns.filter(
      (turn) => turn.status === TurnStatus.SUCCEEDED || turn.status === TurnStatus.FAILED,
    );
    const successCount = completedTurns.filter((turn) => turn.status === TurnStatus.SUCCEEDED).length;
    const failedCount = completedTurns.filter((turn) => turn.status === TurnStatus.FAILED).length;
    const sevenDaySuccessCount = sevenDayCompletedTurns.filter((turn) => turn.status === TurnStatus.SUCCEEDED).length;
    const sevenDayFailedCount = sevenDayCompletedTurns.filter((turn) => turn.status === TurnStatus.FAILED).length;
    const latencyValues = completedTurns
      .map((turn) => turn.latencyMs)
      .filter((value): value is number => typeof value === "number");
    const sevenDayLatencyValues = sevenDayCompletedTurns
      .map((turn) => turn.latencyMs)
      .filter((value): value is number => typeof value === "number");
    const averageLatencyMs = latencyValues.length
      ? Math.round(latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length)
      : 0;
    const sevenDayAverageLatencyMs = sevenDayLatencyValues.length
      ? Math.round(sevenDayLatencyValues.reduce((sum, value) => sum + value, 0) / sevenDayLatencyValues.length)
      : 0;

    const dailyMap = new Map<string, { date: string; generation: number; edit: number; failed: number }>();
    for (const turn of recentTurns) {
      const key = turn.createdAt.toISOString().slice(0, 10);
      const row = dailyMap.get(key) ?? { date: key, generation: 0, edit: 0, failed: 0 };
      if (turn.type === "GENERATION") row.generation += 1;
      if (turn.type === "EDIT") row.edit += 1;
      if (turn.status === TurnStatus.FAILED) row.failed += 1;
      dailyMap.set(key, row);
    }

    const modelMap = new Map<string, number>();
    for (const event of recentUsage) {
      if (event.model) {
        modelMap.set(event.model, (modelMap.get(event.model) ?? 0) + 1);
      }
    }

    const userUsageMap = new Map<
      string,
      { userId: string; email: string; tasks: number; succeeded: number; failed: number; averageLatencyMs: number; totalLatencyMs: number }
    >();
    for (const turn of recentTurns) {
      const email = "unknown";
      const row =
        userUsageMap.get(turn.userId) ??
        { userId: turn.userId, email, tasks: 0, succeeded: 0, failed: 0, averageLatencyMs: 0, totalLatencyMs: 0 };
      row.tasks += 1;
      if (turn.status === TurnStatus.SUCCEEDED) row.succeeded += 1;
      if (turn.status === TurnStatus.FAILED) row.failed += 1;
      if (typeof turn.latencyMs === "number") row.totalLatencyMs += turn.latencyMs;
      userUsageMap.set(turn.userId, row);
    }
    const userEmails = await prisma.user.findMany({
      where: { id: { in: Array.from(userUsageMap.keys()) } },
      select: { id: true, email: true },
    });
    for (const user of userEmails) {
      const row = userUsageMap.get(user.id);
      if (row) row.email = user.email;
    }
    const userUsage = Array.from(userUsageMap.values())
      .map((row) => ({
        userId: row.userId,
        email: row.email,
        tasks: row.tasks,
        succeeded: row.succeeded,
        failed: row.failed,
        averageLatencyMs: row.succeeded + row.failed ? Math.round(row.totalLatencyMs / (row.succeeded + row.failed)) : 0,
      }))
      .sort((a, b) => b.tasks - a.tasks)
      .slice(0, 10);

    const activeUsers = new Set(recentUsage.map((event) => event.userId)).size;
    await writeAuditLog({
      actor: admin,
      action: "admin.analytics.view",
      targetType: "AdminAnalytics",
      metadata: { todayTasks, sevenDayTasks },
      request,
    });

    return ok({
      metrics: {
        todayTasks,
        sevenDayTasks,
        totalUsers,
        activeUsers30d: activeUsers,
        successCount,
        failedCount,
        sevenDaySuccessCount,
        sevenDayFailedCount,
        successRate: completedTurns.length ? Math.round((successCount / completedTurns.length) * 100) : 0,
        failedRate: completedTurns.length ? Math.round((failedCount / completedTurns.length) * 100) : 0,
        sevenDaySuccessRate: sevenDayCompletedTurns.length
          ? Math.round((sevenDaySuccessCount / sevenDayCompletedTurns.length) * 100)
          : 0,
        sevenDayFailedRate: sevenDayCompletedTurns.length
          ? Math.round((sevenDayFailedCount / sevenDayCompletedTurns.length) * 100)
          : 0,
        averageLatencyMs,
        sevenDayAverageLatencyMs,
      },
      daily: Array.from(dailyMap.values()),
      models: Array.from(modelMap.entries()).map(([name, value]) => ({ name, value })),
      failedTurns,
      recentTasks,
      userUsage,
    });
  } catch (error) {
    return handleError(error);
  }
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { startOfDay, endOfDay, addDays } from "date-fns";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekEnd = endOfDay(addDays(now, 7));

  const [openTasks, noteCount, upcomingTasks, recentNotes] = await Promise.all([
    prisma.task.count({
      where: { userId, status: { not: "completed" } },
    }),
    prisma.note.count({
      where: { userId, archivedAt: null },
    }),
    prisma.task.findMany({
      where: {
        userId,
        status: { not: "completed" },
        dueAt: { gte: todayStart, lte: weekEnd },
      },
      orderBy: { dueAt: "asc" },
      take: 5,
    }),
    prisma.note.findMany({
      where: { userId, archivedAt: null },
      orderBy: { updatedAt: "desc" },
      include: { tags: true },
      take: 5,
    }),
  ]);

  const todayTasks = upcomingTasks.filter((t: { dueAt: Date | null }) => {
    if (!t.dueAt) return false;
    return t.dueAt >= todayStart && t.dueAt <= todayEnd;
  });

  return NextResponse.json({
    openTasks,
    noteCount,
    upcomingCount: upcomingTasks.length,
    todayTasks,
    upcomingTasks,
    recentNotes,
  });
}

import { prisma } from "@/lib/db";
import { listEvents } from "@/lib/google-calendar";
import { chatComplete, isOllamaAvailable } from "@/lib/ollama";
import { startOfDay, endOfDay, format, addDays } from "date-fns";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function generateBriefing(userId: string): Promise<string> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekEnd = endOfDay(addDays(now, 7));

  const [openTasks, dueTodayTasks, dueWeekTasks, recentNotes, events, gmailAppts] =
    await Promise.all([
      prisma.task.count({
        where: { userId, status: { not: "completed" } },
      }),
      prisma.task.findMany({
        where: {
          userId,
          status: { not: "completed" },
          dueAt: { gte: todayStart, lte: todayEnd },
        },
        orderBy: { priority: "desc" },
        take: 10,
      }),
      prisma.task.findMany({
        where: {
          userId,
          status: { not: "completed" },
          dueAt: { gt: todayEnd, lte: weekEnd },
        },
        orderBy: { dueAt: "asc" },
        take: 5,
      }),
      prisma.note.findMany({
        where: { userId, archivedAt: null },
        orderBy: { updatedAt: "desc" },
        take: 3,
      }),
      fetchCalendarEvents(userId, todayStart, todayEnd),
      prisma.gmailAppointment.findMany({
        where: {
          userId,
          appointmentDate: { gte: todayStart, lte: todayEnd },
          status: { not: "dismissed" },
        },
        orderBy: { appointmentTime: "asc" },
      }),
    ]);

  const lines: string[] = [];
  lines.push(`<b>☀️ Daily Briefing — ${format(now, "EEEE, MMM d")}</b>`);
  lines.push("");

  // Calendar events
  if (events.length > 0) {
    lines.push("<b>📅 Today's Events</b>");
    for (const e of events) {
      const time = e.start.dateTime
        ? format(new Date(e.start.dateTime), "h:mm a")
        : "All day";
      lines.push(`  • ${time} — ${escapeHtml(e.summary ?? "(No title)")}`);
    }
    lines.push("");
  }

  // Gmail appointments
  if (gmailAppts.length > 0) {
    lines.push("<b>📧 Gmail Appointments</b>");
    for (const a of gmailAppts) {
      const time = a.appointmentTime ?? "TBD";
      const loc = a.location ? ` — ${escapeHtml(a.location)}` : "";
      const badge = a.status === "confirmed" ? " ✓" : "";
      lines.push(`  • ${time} — ${escapeHtml(a.title)}${loc}${badge}`);
    }
    lines.push("");
  }

  // Tasks due today
  if (dueTodayTasks.length > 0) {
    lines.push("<b>✅ Due Today</b>");
    for (const t of dueTodayTasks) {
      const icon = priorityIcon(t.priority);
      lines.push(`  ${icon} ${escapeHtml(t.title)}`);
    }
    lines.push("");
  }

  // Coming up this week
  if (dueWeekTasks.length > 0) {
    lines.push("<b>📋 Coming Up</b>");
    for (const t of dueWeekTasks) {
      const day = format(t.dueAt!, "EEE, MMM d");
      lines.push(`  • ${escapeHtml(t.title)} — ${day}`);
    }
    lines.push("");
  }

  // Stats
  lines.push(`<b>📊 Overview</b>`);
  lines.push(`  • ${openTasks} open task${openTasks === 1 ? "" : "s"}`);
  lines.push(`  • ${events.length} calendar event${events.length === 1 ? "" : "s"} today`);
  if (gmailAppts.length > 0) {
    lines.push(`  • ${gmailAppts.length} Gmail appointment${gmailAppts.length === 1 ? "" : "s"} today`);
  }
  if (recentNotes.length > 0) {
    lines.push(
      `  • Latest note: ${escapeHtml(recentNotes[0].title)}`
    );
  }

  if (
    events.length === 0 &&
    dueTodayTasks.length === 0 &&
    dueWeekTasks.length === 0
  ) {
    lines.push("");
    lines.push("Nothing urgent today — enjoy your day! 🎉");
  }

  return lines.join("\n");
}

export async function generateTaskList(userId: string): Promise<string> {
  const tasks = await prisma.task.findMany({
    where: { userId, status: { not: "completed" } },
    orderBy: [{ priority: "desc" }, { dueAt: "asc" }],
    take: 15,
  });

  if (tasks.length === 0) return "No open tasks — you're all caught up! 🎉";

  const lines = [`<b>✅ Open Tasks (${tasks.length})</b>`, ""];
  for (const t of tasks) {
    const icon = priorityIcon(t.priority);
    const due = t.dueAt ? ` — ${format(t.dueAt, "MMM d")}` : "";
    lines.push(`${icon} ${escapeHtml(t.title)}${due}`);
  }
  return lines.join("\n");
}

export async function generateNoteList(userId: string): Promise<string> {
  const notes = await prisma.note.findMany({
    where: { userId, archivedAt: null },
    orderBy: { updatedAt: "desc" },
    include: { tags: true },
    take: 10,
  });

  if (notes.length === 0) return "No notes yet.";

  const lines = [`<b>📝 Recent Notes</b>`, ""];
  for (const n of notes) {
    const tags = n.tags.map((t) => `#${t.tag}`).join(" ");
    const date = format(n.updatedAt, "MMM d");
    lines.push(`• <b>${escapeHtml(n.title)}</b> — ${date}`);
    if (tags) lines.push(`  ${tags}`);
  }
  return lines.join("\n");
}

function priorityIcon(priority: string): string {
  switch (priority) {
    case "urgent":
      return "🔴";
    case "high":
      return "🟠";
    case "medium":
      return "🟡";
    default:
      return "🔵";
  }
}

export async function generateAIBriefing(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ollamaModel: true, aiBriefingEnabled: true },
  });

  if (!user?.aiBriefingEnabled) {
    return generateBriefing(userId);
  }

  const available = await isOllamaAvailable();
  if (!available) {
    return generateBriefing(userId);
  }

  const dataBriefing = await generateBriefing(userId);

  try {
    const aiSummary = await chatComplete(user.ollamaModel, [
      {
        role: "system",
        content:
          "You are LifeFlow AI, a personal productivity assistant. Given the user's daily briefing data, write a concise, friendly natural-language summary. Highlight the most important items, suggest what to focus on first, and note any potential conflicts or tight deadlines. Keep it under 200 words. Use Telegram-safe HTML formatting (<b>, <i>) only. Do not use markdown.",
      },
      {
        role: "user",
        content: `Here's my daily briefing data:\n\n${dataBriefing}\n\nGive me a natural-language summary with prioritization advice.`,
      },
    ]);

    return `<b>🤖 AI Briefing</b>\n\n${aiSummary}\n\n---\n\n${dataBriefing}`;
  } catch {
    return dataBriefing;
  }
}

async function fetchCalendarEvents(
  userId: string,
  start: Date,
  end: Date
): Promise<{ summary?: string; start: { dateTime?: string; date?: string } }[]> {
  try {
    return await listEvents(userId, start.toISOString(), end.toISOString());
  } catch {
    return [];
  }
}

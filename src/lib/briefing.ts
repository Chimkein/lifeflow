import { prisma } from "@/lib/db";
import { listEvents } from "@/lib/google-calendar";
import { isOllamaAvailable } from "@/lib/ollama";
import { generateReply, isGeminiConfigured } from "@/lib/ai";
import { startOfZonedDay, endOfZonedDay, addZonedDays, formatInTZ, zonedParts, DEFAULT_TIMEZONE } from "@/lib/timezone";

// Format a task due date, appending the time only when the task has one (a
// due set to local midnight is treated as an all-day/date-only task).
function formatDue(due: Date, opts: Intl.DateTimeFormatOptions, tz: string): string {
  const base = formatInTZ(due, opts, tz);
  const { hour, minute } = zonedParts(due, tz);
  if (hour === 0 && minute === 0) return base;
  const time = formatInTZ(due, { hour: "numeric", minute: "2-digit", hour12: true }, tz);
  return `${base}, ${time}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function getUserTimezone(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  return u?.timezone ?? DEFAULT_TIMEZONE;
}

export async function generateBriefing(userId: string): Promise<string> {
  const now = new Date();
  const tz = await getUserTimezone(userId);
  const todayStart = startOfZonedDay(now, tz);
  const todayEnd = endOfZonedDay(now, tz);
  const weekEnd = endOfZonedDay(addZonedDays(now, 7, tz), tz);

  const [openTasks, dueTodayTasks, dueWeekTasks, recentNotes, calendarResult, gmailAppts] =
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

  const { events, reauthRequired: calendarReauthRequired } = calendarResult;

  const lines: string[] = [];
  lines.push(`<b>☀️ Daily Briefing — ${formatInTZ(now, { weekday: "long", month: "short", day: "numeric" }, tz)}</b>`);
  lines.push("");

  // Calendar events
  if (calendarReauthRequired) {
    lines.push("⚠️ <b>Calendar disconnected — reconnect in Settings</b>");
    lines.push("");
  } else if (events.length > 0) {
    lines.push("<b>📅 Today's Events</b>");
    for (const e of events) {
      const time = e.start.dateTime
        ? formatInTZ(new Date(e.start.dateTime), { hour: "numeric", minute: "2-digit", hour12: true }, tz)
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
      const { hour, minute } = zonedParts(t.dueAt!, tz);
      const at =
        hour === 0 && minute === 0
          ? ""
          : ` — ${formatInTZ(t.dueAt!, { hour: "numeric", minute: "2-digit", hour12: true }, tz)}`;
      lines.push(`  ${icon} ${escapeHtml(t.title)}${at}`);
    }
    lines.push("");
  }

  // Coming up this week
  if (dueWeekTasks.length > 0) {
    lines.push("<b>📋 Coming Up</b>");
    for (const t of dueWeekTasks) {
      const day = formatDue(t.dueAt!, { weekday: "short", month: "short", day: "numeric" }, tz);
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
  const tz = await getUserTimezone(userId);
  const tasks = await prisma.task.findMany({
    where: { userId, status: { not: "completed" } },
    orderBy: [{ priority: "desc" }, { dueAt: "asc" }],
    take: 15,
  });

  if (tasks.length === 0) return "No open tasks — you're all caught up! 🎉";

  const lines = [`<b>✅ Open Tasks (${tasks.length})</b>`, ""];
  for (const t of tasks) {
    const icon = priorityIcon(t.priority);
    const due = t.dueAt ? ` — ${formatDue(t.dueAt, { month: "short", day: "numeric" }, tz)}` : "";
    lines.push(`${icon} ${escapeHtml(t.title)}${due}`);
  }
  return lines.join("\n");
}

export async function generateNoteList(userId: string): Promise<string> {
  const tz = await getUserTimezone(userId);
  const notes = await prisma.note.findMany({
    where: { userId, archivedAt: null },
    orderBy: { updatedAt: "desc" },
    include: { tags: true },
    take: 10,
  });

  if (notes.length === 0) return "No notes yet.";

  const lines = [`<b>📝 Recent Notes</b>`, ""];
  for (const n of notes) {
    const tags = n.tags.map((t: { tag: string }) => `#${t.tag}`).join(" ");
    const date = formatInTZ(n.updatedAt, { month: "short", day: "numeric" }, tz);
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

  const available = isGeminiConfigured() || (await isOllamaAvailable());
  if (!available) {
    return generateBriefing(userId);
  }

  const dataBriefing = await generateBriefing(userId);

  try {
    const { text: aiSummary } = await generateReply([
      {
        role: "system",
        content:
          "You are LifeFlow AI, a personal productivity assistant. Given the user's daily briefing data, write a concise, friendly natural-language summary. Highlight the most important items, suggest what to focus on first, and note any potential conflicts or tight deadlines. Keep it under 200 words. Use Telegram-safe HTML formatting (<b>, <i>) only. Do not use markdown.",
      },
      {
        role: "user",
        content: `Here's my daily briefing data:\n\n${dataBriefing}\n\nGive me a natural-language summary with prioritization advice.`,
      },
    ], user.ollamaModel);

    return `<b>🤖 AI Briefing</b>\n\n${aiSummary}\n\n---\n\n${dataBriefing}`;
  } catch {
    return dataBriefing;
  }
}

const REAUTH_ERRORS = new Set(["REAUTH_REQUIRED", "NO_REFRESH_TOKEN", "NO_GOOGLE_ACCOUNT"]);

type CalendarFetchResult = {
  events: { summary?: string; start: { dateTime?: string; date?: string } }[];
  reauthRequired: boolean;
};

async function fetchCalendarEvents(
  userId: string,
  start: Date,
  end: Date
): Promise<CalendarFetchResult> {
  try {
    const events = await listEvents(userId, start.toISOString(), end.toISOString());
    return { events, reauthRequired: false };
  } catch (err) {
    const reauthRequired =
      err instanceof Error &&
      (REAUTH_ERRORS.has(err.message) ||
        /Calendar API error (401|403)/.test(err.message));
    return { events: [], reauthRequired };
  }
}

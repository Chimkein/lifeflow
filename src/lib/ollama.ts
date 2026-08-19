import { prisma } from "@/lib/db";
import { listEvents } from "@/lib/google-calendar";
import { startOfZonedDay, endOfZonedDay, formatInTZ } from "@/lib/timezone";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_API_KEY = process.env.GROQ_API_KEY ?? "";

const AVAILABLE_MODELS = [
  { name: "openai/gpt-oss-20b", label: "GPT-OSS 20B" },
  { name: "openai/gpt-oss-120b", label: "GPT-OSS 120B" },
  { name: "qwen/qwen3.6-27b", label: "Qwen 3.6 27B" },
  { name: "meta-llama/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout" },
];

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function isOllamaAvailable(): Promise<boolean> {
  return !!GROQ_API_KEY;
}

export async function listModels(): Promise<{ name: string; size: number }[]> {
  return AVAILABLE_MODELS.map((m) => ({ name: m.name, size: 0 }));
}

export async function chatStream(
  model: string,
  messages: ChatMessage[],
  signal?: AbortSignal
): Promise<ReadableStream<string>> {
  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({ model, messages, stream: true, max_tokens: 1024, temperature: 0.7 }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`Groq error ${res.status}: ${text}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();

  return new ReadableStream<string>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n").filter(Boolean)) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") {
          controller.close();
          return;
        }
        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            controller.enqueue(content);
          }
        } catch {
          // partial JSON, skip
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}

export async function chatComplete(
  model: string,
  messages: ChatMessage[]
): Promise<string> {
  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({ model, messages, stream: false, max_tokens: 1024, temperature: 0.7 }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    throw new Error(`Groq error ${res.status}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export async function buildUserContext(userId: string): Promise<string> {
  const now = new Date();
  const todayStart = startOfZonedDay(now);
  const todayEnd = endOfZonedDay(now);

  const [tasks, notes, calendarResult, gmailAppts] = await Promise.all([
    prisma.task.findMany({
      where: { userId, status: { not: "completed" } },
      orderBy: [{ priority: "desc" }, { dueAt: "asc" }],
      take: 20,
    }),
    prisma.note.findMany({
      where: { userId, archivedAt: null },
      orderBy: { updatedAt: "desc" },
      include: { tags: true },
      take: 10,
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
  lines.push(
    `Current date and time: ${formatInTZ(now, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} at ${formatInTZ(now, { hour: "numeric", minute: "2-digit", hour12: true })}`
  );
  lines.push("");

  if (calendarReauthRequired) {
    lines.push("CALENDAR: not connected (user needs to reconnect Google in Settings)");
    lines.push("");
  } else if (events.length > 0) {
    lines.push("TODAY'S CALENDAR EVENTS:");
    for (const e of events) {
      const time = e.start.dateTime
        ? formatInTZ(new Date(e.start.dateTime), { hour: "numeric", minute: "2-digit", hour12: true })
        : "All day";
      lines.push(`- ${time}: ${e.summary ?? "(No title)"}`);
    }
    lines.push("");
  }

  if (gmailAppts.length > 0) {
    lines.push("GMAIL-DETECTED APPOINTMENTS:");
    for (const a of gmailAppts) {
      const time = a.appointmentTime ?? "Time TBD";
      const loc = a.location ? ` at ${a.location}` : "";
      const status = a.status === "confirmed" ? " [confirmed]" : " [pending]";
      lines.push(`- ${time}: ${a.title}${loc}${status}`);
    }
    lines.push("");
  }

  if (tasks.length > 0) {
    lines.push("OPEN TASKS:");
    for (const t of tasks) {
      const due = t.dueAt ? ` (due ${formatInTZ(t.dueAt, { month: "short", day: "numeric" })})` : "";
      lines.push(`- [${t.priority}] ${t.title}${due}`);
    }
    lines.push("");
  }

  if (notes.length > 0) {
    lines.push("RECENT NOTES:");
    for (const n of notes) {
      const tags = n.tags.map((t: { tag: string }) => `#${t.tag}`).join(" ");
      const preview = n.content.slice(0, 100).replace(/\n/g, " ");
      lines.push(`- "${n.title}" (${formatInTZ(n.updatedAt, { month: "short", day: "numeric" })})${tags ? ` ${tags}` : ""}`);
      if (preview) lines.push(`  ${preview}${n.content.length > 100 ? "..." : ""}`);
    }
  }

  return lines.join("\n");
}

const SYSTEM_PROMPT = `You are LifeFlow AI, a helpful personal productivity assistant. You have access to the user's calendar events, tasks, and notes. Use this context to give relevant, actionable advice.

Be concise and friendly. When discussing tasks, reference them by name. When suggesting priorities, consider due dates and priority levels. Keep responses brief unless the user asks for detail.`;

export function buildSystemMessage(userContext: string): ChatMessage {
  return {
    role: "system",
    content: `${SYSTEM_PROMPT}\n\n---\nUSER'S CURRENT DATA:\n${userContext}`,
  };
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

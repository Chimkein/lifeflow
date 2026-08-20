import { prisma } from "@/lib/db";
import { createEvent, updateEvent, deleteEvent } from "@/lib/google-calendar";
import type { ChatMessage } from "@/lib/ollama";
import { wallTimeToInstant, DEFAULT_TIMEZONE } from "@/lib/timezone";

// Tool calling for the AI chat: lets the assistant create/edit/complete/delete
// the user's tasks, notes, and calendar events. Every executor is scoped to the
// signed-in userId. Deletes are guarded by the system prompt (the model must
// confirm with the user first). Uses the OpenAI-compatible chat-completions API,
// which both Groq and Gemini speak, so one loop serves both providers.

const MAX_TOOL_ROUNDS = 6;

// Deletes are hard-gated: the server never executes them inline. It returns a
// pending action to the UI, which must be confirmed via the confirm endpoint.
export const DESTRUCTIVE_TOOLS = new Set(["delete_task", "delete_note", "delete_event"]);

export interface PendingAction {
  token: string;
  name: string;
  args: Record<string, unknown>;
  label: string;
}

async function describePending(userId: string, name: string, args: Record<string, unknown>): Promise<string> {
  try {
    if (name === "delete_task") {
      const t = await prisma.task.findFirst({ where: { id: String(args.taskId), userId }, select: { title: true } });
      return t ? `task "${t.title}"` : "this task";
    }
    if (name === "delete_note") {
      const n = await prisma.note.findFirst({ where: { id: String(args.noteId), userId }, select: { title: true } });
      return n ? `note "${n.title}"` : "this note";
    }
    if (name === "delete_event") return "this calendar event";
  } catch {
    /* fall through */
  }
  return "this item";
}

// ---- Tool schemas (OpenAI function format) --------------------------------

export const TOOLS = [
  fn("create_task", "Create a new task.", {
    title: str("Task title"),
    priority: enumStr("Priority", ["low", "medium", "high", "urgent"]),
    dueAt: str("Due date/time as an ISO 8601 string, or omit"),
    description: str("Optional details"),
  }, ["title"]),
  fn("update_task", "Update an existing task's fields.", {
    taskId: str("The task's id"),
    title: str("New title"),
    priority: enumStr("Priority", ["low", "medium", "high", "urgent"]),
    dueAt: str("New due date/time as ISO 8601, or 'none' to clear"),
    status: enumStr("Status", ["pending", "in_progress", "completed"]),
    description: str("New details"),
  }, ["taskId"]),
  fn("complete_task", "Mark a task as completed.", { taskId: str("The task's id") }, ["taskId"]),
  fn("delete_task", "Delete a task permanently. Confirm with the user first.", { taskId: str("The task's id") }, ["taskId"]),

  fn("create_note", "Create a new note.", {
    title: str("Note title"),
    content: str("Note body"),
    tags: { type: "array", items: { type: "string" }, description: "Optional tags" },
  }, ["title"]),
  fn("update_note", "Update a note's title or content.", {
    noteId: str("The note's id"),
    title: str("New title"),
    content: str("New content"),
  }, ["noteId"]),
  fn("delete_note", "Delete a note permanently. Confirm with the user first.", { noteId: str("The note's id") }, ["noteId"]),

  fn("create_event", "Create a calendar event.", {
    summary: str("Event title"),
    start: str("Start: ISO 8601 datetime for timed events, or YYYY-MM-DD for all-day"),
    end: str("End: ISO 8601 datetime, or YYYY-MM-DD for all-day (exclusive)"),
    allDay: { type: "boolean", description: "True for an all-day event" },
    location: str("Optional location"),
    description: str("Optional description"),
  }, ["summary", "start"]),
  fn("update_event", "Update a calendar event.", {
    eventId: str("The event's id"),
    summary: str("New title"),
    start: str("New start (ISO datetime or YYYY-MM-DD)"),
    end: str("New end (ISO datetime or YYYY-MM-DD)"),
    allDay: { type: "boolean", description: "True for all-day" },
    location: str("New location"),
    description: str("New description"),
  }, ["eventId"]),
  fn("delete_event", "Delete a calendar event permanently. Confirm with the user first.", { eventId: str("The event's id") }, ["eventId"]),
];

function fn(name: string, description: string, props: Record<string, object>, required: string[]) {
  return {
    type: "function" as const,
    function: { name, description, parameters: { type: "object", properties: props, required } },
  };
}
function str(description: string) {
  return { type: "string", description };
}
function enumStr(description: string, values: string[]) {
  return { type: "string", enum: values, description };
}

// ---- Executor (all scoped to userId) --------------------------------------

type ToolResult = Record<string, unknown>;

function parseDate(v: unknown, tz: string): Date | null {
  if (typeof v !== "string" || !v || v.toLowerCase() === "none") return null;
  const s = v.trim();
  // A naive date / date-time (no timezone designator) is interpreted in the
  // user's timezone; an offset-bearing string (…Z / …+08:00) is taken as-is.
  const naive = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2})(?::\d{2})?)?$/.exec(s);
  if (naive) {
    return wallTimeToInstant(naive[1], naive[2] ?? null, tz);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function addOneDay(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return dt.toISOString().slice(0, 10);
}

function buildEventInput(a: Record<string, unknown>, tz: string) {
  const summary = String(a.summary ?? "");
  const location = a.location ? String(a.location) : undefined;
  const description = a.description ? String(a.description) : undefined;
  const start = String(a.start ?? "");
  if (a.allDay) {
    const end = a.end ? String(a.end) : addOneDay(start);
    return { summary, location, description, start: { date: start }, end: { date: end <= start ? addOneDay(start) : end } };
  }
  const end = a.end ? String(a.end) : start;
  return { summary, location, description, start: { dateTime: start, timeZone: tz }, end: { dateTime: end, timeZone: tz } };
}

export async function executeTool(
  userId: string,
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  try {
    const userRow = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    const tz = userRow?.timezone ?? DEFAULT_TIMEZONE;

    switch (name) {
      case "create_task": {
        const t = await prisma.task.create({
          data: {
            userId,
            title: String(args.title),
            priority: (args.priority as string) ?? "medium",
            dueAt: parseDate(args.dueAt, tz),
            description: args.description ? String(args.description) : null,
          },
        });
        return { ok: true, id: t.id, title: t.title };
      }
      case "update_task": {
        const data: Record<string, unknown> = {};
        if (args.title !== undefined) data.title = String(args.title);
        if (args.priority !== undefined) data.priority = String(args.priority);
        if (args.description !== undefined) data.description = String(args.description);
        if (args.dueAt !== undefined) data.dueAt = parseDate(args.dueAt, tz);
        if (args.status !== undefined) {
          data.status = String(args.status);
          if (args.status === "completed") data.completedAt = new Date();
        }
        const r = await prisma.task.updateMany({ where: { id: String(args.taskId), userId }, data });
        return r.count ? { ok: true, updated: r.count } : { ok: false, error: "Task not found" };
      }
      case "complete_task": {
        const r = await prisma.task.updateMany({
          where: { id: String(args.taskId), userId },
          data: { status: "completed", completedAt: new Date() },
        });
        return r.count ? { ok: true } : { ok: false, error: "Task not found" };
      }
      case "delete_task": {
        const r = await prisma.task.deleteMany({ where: { id: String(args.taskId), userId } });
        return r.count ? { ok: true } : { ok: false, error: "Task not found" };
      }
      case "create_note": {
        const tags = Array.isArray(args.tags) ? (args.tags as string[]) : [];
        const n = await prisma.note.create({
          data: {
            userId,
            title: String(args.title),
            content: args.content ? String(args.content) : "",
            tags: tags.length ? { create: tags.map((tag) => ({ tag: String(tag) })) } : undefined,
          },
        });
        return { ok: true, id: n.id, title: n.title };
      }
      case "update_note": {
        const data: Record<string, unknown> = {};
        if (args.title !== undefined) data.title = String(args.title);
        if (args.content !== undefined) data.content = String(args.content);
        const r = await prisma.note.updateMany({ where: { id: String(args.noteId), userId }, data });
        return r.count ? { ok: true } : { ok: false, error: "Note not found" };
      }
      case "delete_note": {
        const r = await prisma.note.deleteMany({ where: { id: String(args.noteId), userId } });
        return r.count ? { ok: true } : { ok: false, error: "Note not found" };
      }
      case "create_event": {
        const e = await createEvent(userId, buildEventInput(args, tz));
        return { ok: true, id: e.id, summary: e.summary };
      }
      case "update_event": {
        const e = await updateEvent(userId, String(args.eventId), buildEventInput(args, tz));
        return { ok: true, id: e.id, summary: e.summary };
      }
      case "delete_event": {
        await deleteEvent(userId, String(args.eventId));
        return { ok: true };
      }
      default:
        return { ok: false, error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Tool failed" };
  }
}

// ---- Provider config + tool-calling loop ----------------------------------

interface Provider {
  name: "gemini" | "groq";
  baseUrl: string;
  apiKey: string;
  model: string;
  extraBody?: Record<string, unknown>;
}

function providers(groqModel: string): Provider[] {
  const list: Provider[] = [];
  const gemini = process.env.GEMINI_API_KEY;
  if (gemini) {
    list.push({
      name: "gemini",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: gemini,
      model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
    });
  }
  list.push({
    name: "groq",
    baseUrl: "https://api.groq.com/openai/v1",
    apiKey: process.env.GROQ_API_KEY ?? "",
    model: groqModel,
    extraBody: { reasoning_effort: "low" },
  });
  return list;
}

export interface ToolChatResult {
  text: string;
  provider: string;
  actions: { name: string; ok: boolean }[];
  pendingActions: PendingAction[];
}

async function runToolLoop(p: Provider, userId: string, messages: ChatMessage[]): Promise<ToolChatResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const convo: any[] = [...messages];
  const actions: { name: string; ok: boolean }[] = [];
  const pending: PendingAction[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const res = await fetch(`${p.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.apiKey}` },
      body: JSON.stringify({
        model: p.model,
        messages: convo,
        tools: TOOLS,
        tool_choice: "auto",
        max_tokens: 1024,
        temperature: 0.4,
        ...p.extraBody,
      }),
      signal: AbortSignal.timeout(40000),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`${p.name} error ${res.status}: ${t}`);
    }
    const data = await res.json();
    const msg = data.choices?.[0]?.message;
    const toolCalls = msg?.tool_calls;

    if (Array.isArray(toolCalls) && toolCalls.length > 0) {
      convo.push(msg);
      for (const tc of toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {
          /* leave empty */
        }
        if (DESTRUCTIVE_TOOLS.has(tc.function.name)) {
          // Hard gate: do NOT delete. Surface a pending action for the UI to
          // confirm, and tell the model it isn't deleted yet.
          const label = await describePending(userId, tc.function.name, args);
          pending.push({ token: tc.id, name: tc.function.name, args, label });
          convo.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({
              ok: false,
              status: "awaiting_user_confirmation",
              note: `NOT deleted yet. A confirmation button for ${label} has been shown to the user; it will only be removed if they click Confirm.`,
            }),
          });
        } else {
          const result = await executeTool(userId, tc.function.name, args);
          actions.push({ name: tc.function.name, ok: result.ok === true });
          convo.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
        }
      }
      continue; // let the model react to the tool results
    }

    return { text: msg?.content ?? "", provider: p.name, actions, pendingActions: pending };
  }
  return { text: "I made several changes but stopped to avoid looping. Please check the result.", provider: p.name, actions, pendingActions: pending };
}

// Run the tool-enabled chat with provider fallback (Gemini primary if
// configured, else Groq).
export async function chatWithTools(userId: string, messages: ChatMessage[], groqModel: string): Promise<ToolChatResult> {
  const list = providers(groqModel);
  let lastErr: unknown;
  for (const p of list) {
    if (!p.apiKey) continue;
    try {
      return await runToolLoop(p, userId, messages);
    } catch (err) {
      console.error(`[AI Tools] ${p.name} failed:`, err);
      lastErr = err;
    }
  }
  throw lastErr ?? new Error("No AI provider configured");
}

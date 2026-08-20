// Lightweight, dependency-free input validation for API routes.
//
// Every helper throws `ValidationError` on bad input; routes catch it via
// `validationError()` and return a clean 400 (never leaking internals). Keeping
// these pure (no next/prisma imports) makes them trivially unit-testable.

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// Upper bounds on user-supplied free text. These cap storage growth and, for
// the AI message, the size of a single paid-LLM request.
export const LIMITS = {
  taskTitle: 200,
  taskDescription: 5_000,
  noteTitle: 200,
  noteContent: 50_000,
  tag: 50,
  tagsMax: 30,
  aiMessage: 8_000,
  eventSummary: 500,
  eventDescription: 5_000,
  eventLocation: 500,
} as const;

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const TASK_STATUSES = ["pending", "in_progress", "completed"] as const;

/** Required non-empty string, trimmed, length-capped. */
export function reqString(v: unknown, field: string, max: number): string {
  if (typeof v !== "string" || !v.trim()) {
    throw new ValidationError(`${field} is required`);
  }
  const t = v.trim();
  if (t.length > max) {
    throw new ValidationError(`${field} must be at most ${max} characters`);
  }
  return t;
}

/**
 * Optional string. Returns `undefined` when absent (so callers can skip the
 * field), the length-capped value otherwise. `trim` defaults on.
 */
export function optString(
  v: unknown,
  field: string,
  max: number,
  { trim = true }: { trim?: boolean } = {}
): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") {
    throw new ValidationError(`${field} must be a string`);
  }
  const val = trim ? v.trim() : v;
  if (val.length > max) {
    throw new ValidationError(`${field} must be at most ${max} characters`);
  }
  return val;
}

/** Optional value constrained to an allow-list. */
export function optEnum<T extends string>(
  v: unknown,
  field: string,
  allowed: readonly T[]
): T | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string" || !allowed.includes(v as T)) {
    throw new ValidationError(`${field} must be one of: ${allowed.join(", ")}`);
  }
  return v as T;
}

/** Optional array of non-empty tag strings, each trimmed and length-capped. */
export function optTags(v: unknown, field = "tags"): string[] | undefined {
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v)) {
    throw new ValidationError(`${field} must be an array`);
  }
  if (v.length > LIMITS.tagsMax) {
    throw new ValidationError(`Too many ${field} (max ${LIMITS.tagsMax})`);
  }
  return v
    .map((t) => {
      if (typeof t !== "string") {
        throw new ValidationError(`Each tag must be a string`);
      }
      const trimmed = t.trim();
      if (trimmed.length > LIMITS.tag) {
        throw new ValidationError(
          `Each tag must be at most ${LIMITS.tag} characters`
        );
      }
      return trimmed;
    })
    .filter(Boolean);
}

/**
 * Optional date. `undefined` → undefined (skip the field); `null`/`""` → null
 * (explicitly clear it); any other value must parse to a valid Date or it
 * throws. Guards against `new Date("garbage")` silently becoming Invalid Date.
 */
export function optDate(v: unknown, field: string): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const d = new Date(v as string | number);
  if (Number.isNaN(d.getTime())) {
    throw new ValidationError(`${field} is not a valid date`);
  }
  return d;
}

/** 24-hour "HH:mm" clock string. */
export function isValidHm(v: unknown): v is string {
  return typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

/**
 * Parse a task due value sent as a naive local wall-clock string:
 *   undefined      -> undefined (field absent; PATCH should skip it)
 *   null | ""      -> null      (explicitly clear the due date)
 *   "YYYY-MM-DD"           -> { date, time: null }  (all-day / date-only)
 *   "YYYY-MM-DDTHH:mm"     -> { date, time }        (specific time)
 * The caller converts {date,time} to a UTC instant in the user's timezone via
 * wallTimeToInstant(). Throws ValidationError on any other shape.
 */
export function parseLocalDue(
  v: unknown
): { date: string; time: string | null } | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  if (typeof v !== "string") {
    throw new ValidationError("Due date must be a string");
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ]([01]\d|2[0-3]):([0-5]\d))?$/.exec(v.trim());
  if (!m) {
    throw new ValidationError(
      "Due date must be YYYY-MM-DD or YYYY-MM-DDTHH:mm"
    );
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  const probe = new Date(Date.UTC(y, mo - 1, da));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== mo - 1 ||
    probe.getUTCDate() !== da
  ) {
    throw new ValidationError("Due date is not a real calendar date");
  }
  return { date: `${m[1]}-${m[2]}-${m[3]}`, time: m[4] ? `${m[4]}:${m[5]}` : null };
}

// ---- Google Calendar event shape ----------------------------------------

type TimePoint = { dateTime?: string; date?: string; timeZone?: string };

export interface CalendarEventFields {
  summary: string;
  description?: string;
  location?: string;
  start: TimePoint;
  end: TimePoint;
}

function parseTimePoint(v: unknown, field: string): TimePoint {
  if (typeof v !== "object" || v === null) {
    throw new ValidationError(`${field} is required`);
  }
  const o = v as Record<string, unknown>;
  const out: TimePoint = {};
  if (o.dateTime !== undefined) {
    if (
      typeof o.dateTime !== "string" ||
      Number.isNaN(new Date(o.dateTime).getTime())
    ) {
      throw new ValidationError(`${field}.dateTime is not a valid datetime`);
    }
    out.dateTime = o.dateTime;
  }
  if (o.date !== undefined) {
    if (typeof o.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(o.date)) {
      throw new ValidationError(`${field}.date must be YYYY-MM-DD`);
    }
    out.date = o.date;
  }
  if (o.timeZone !== undefined) {
    if (typeof o.timeZone !== "string" || o.timeZone.length > 100) {
      throw new ValidationError(`${field}.timeZone is invalid`);
    }
    out.timeZone = o.timeZone;
  }
  if (!out.dateTime && !out.date) {
    throw new ValidationError(`${field} must have a date or dateTime`);
  }
  return out;
}

/**
 * Validate a calendar-event payload before it is forwarded to the Google
 * Calendar API. Returns a whitelisted object containing ONLY the known fields
 * (summary/description/location/start/end) — this both validates types and
 * strips any unexpected keys the caller may have injected. `partial: true` (for
 * PATCH) makes every field optional but still validates whatever is present.
 */
export function parseCalendarEvent(
  body: unknown,
  { partial = false }: { partial?: boolean } = {}
): Partial<CalendarEventFields> {
  if (typeof body !== "object" || body === null) {
    throw new ValidationError("Event body is required");
  }
  const o = body as Record<string, unknown>;
  const out: Partial<CalendarEventFields> = {};

  const summary = partial
    ? optString(o.summary, "Summary", LIMITS.eventSummary)
    : reqString(o.summary, "Summary", LIMITS.eventSummary);
  if (summary !== undefined) out.summary = summary;

  const description = optString(o.description, "Description", LIMITS.eventDescription);
  if (description !== undefined) out.description = description;

  const location = optString(o.location, "Location", LIMITS.eventLocation);
  if (location !== undefined) out.location = location;

  if (!partial || o.start !== undefined) out.start = parseTimePoint(o.start, "start");
  if (!partial || o.end !== undefined) out.end = parseTimePoint(o.end, "end");

  return out;
}

import { describe, it, expect } from "vitest";
import {
  reqString,
  optString,
  optEnum,
  optTags,
  optDate,
  parseLocalDue,
  isValidHm,
  parseCalendarEvent,
  ValidationError,
  LIMITS,
  TASK_PRIORITIES,
} from "./validation";

describe("reqString", () => {
  it("trims and returns a valid string", () => {
    expect(reqString("  hi  ", "Field", 10)).toBe("hi");
  });
  it("rejects empty/whitespace", () => {
    expect(() => reqString("   ", "Title", 10)).toThrow(ValidationError);
    expect(() => reqString(undefined, "Title", 10)).toThrow(/Title is required/);
  });
  it("rejects over-length", () => {
    expect(() => reqString("x".repeat(11), "Title", 10)).toThrow(/at most 10/);
  });
});

describe("optString", () => {
  it("returns undefined when absent", () => {
    expect(optString(undefined, "F", 10)).toBeUndefined();
    expect(optString(null, "F", 10)).toBeUndefined();
  });
  it("can skip trimming", () => {
    expect(optString(" a ", "F", 10, { trim: false })).toBe(" a ");
  });
  it("enforces max length", () => {
    expect(() => optString("x".repeat(11), "F", 10)).toThrow(ValidationError);
  });
});

describe("optEnum", () => {
  it("accepts allowed values", () => {
    expect(optEnum("high", "Priority", TASK_PRIORITIES)).toBe("high");
  });
  it("returns undefined when absent", () => {
    expect(optEnum(undefined, "Priority", TASK_PRIORITIES)).toBeUndefined();
  });
  it("rejects values outside the allow-list", () => {
    expect(() => optEnum("nope", "Priority", TASK_PRIORITIES)).toThrow(
      ValidationError
    );
  });
});

describe("optTags", () => {
  it("trims and drops empties", () => {
    expect(optTags(["  a ", "", "b"])).toEqual(["a", "b"]);
  });
  it("rejects non-arrays and non-string elements", () => {
    expect(() => optTags("a")).toThrow(ValidationError);
    expect(() => optTags([1])).toThrow(/must be a string/);
  });
  it("caps the number of tags", () => {
    expect(() => optTags(Array(LIMITS.tagsMax + 1).fill("t"))).toThrow(
      /Too many/
    );
  });
});

describe("optDate", () => {
  it("undefined stays undefined, null/empty clears", () => {
    expect(optDate(undefined, "D")).toBeUndefined();
    expect(optDate(null, "D")).toBeNull();
    expect(optDate("", "D")).toBeNull();
  });
  it("parses a valid date", () => {
    expect(optDate("2026-01-02T03:04:00Z", "D")).toBeInstanceOf(Date);
  });
  it("rejects garbage", () => {
    expect(() => optDate("not-a-date", "D")).toThrow(/not a valid date/);
  });
});

describe("parseLocalDue", () => {
  it("undefined stays undefined, null/empty clears", () => {
    expect(parseLocalDue(undefined)).toBeUndefined();
    expect(parseLocalDue(null)).toBeNull();
    expect(parseLocalDue("")).toBeNull();
  });
  it("parses a date-only value (all-day)", () => {
    expect(parseLocalDue("2026-08-21")).toEqual({ date: "2026-08-21", time: null });
  });
  it("parses a date + time value", () => {
    expect(parseLocalDue("2026-08-21T15:30")).toEqual({ date: "2026-08-21", time: "15:30" });
    expect(parseLocalDue("2026-08-21 15:30")).toEqual({ date: "2026-08-21", time: "15:30" });
  });
  it("rejects malformed values", () => {
    expect(() => parseLocalDue("21-08-2026")).toThrow(ValidationError);
    expect(() => parseLocalDue("2026-08-21T99:99")).toThrow(ValidationError);
    expect(() => parseLocalDue(12345)).toThrow(ValidationError);
  });
});

describe("isValidHm", () => {
  it("accepts HH:mm", () => {
    expect(isValidHm("07:00")).toBe(true);
    expect(isValidHm("23:59")).toBe(true);
  });
  it("rejects malformed times", () => {
    expect(isValidHm("9:00")).toBe(false);
    expect(isValidHm("24:00")).toBe(false);
    expect(isValidHm("garbage")).toBe(false);
    expect(isValidHm(700)).toBe(false);
  });
});

describe("parseCalendarEvent", () => {
  const good = {
    summary: "Meet",
    start: { dateTime: "2026-01-02T10:00:00Z" },
    end: { dateTime: "2026-01-02T11:00:00Z" },
  };

  it("accepts a valid event and strips unknown fields", () => {
    const out = parseCalendarEvent({ ...good, evilField: "x", attendees: [] });
    expect(out.summary).toBe("Meet");
    expect((out as Record<string, unknown>).evilField).toBeUndefined();
    expect((out as Record<string, unknown>).attendees).toBeUndefined();
  });
  it("requires summary/start/end on create", () => {
    expect(() => parseCalendarEvent({ start: good.start })).toThrow(
      ValidationError
    );
  });
  it("allows partial updates", () => {
    const out = parseCalendarEvent({ summary: "New title" }, { partial: true });
    expect(out.summary).toBe("New title");
    expect(out.start).toBeUndefined();
  });
  it("rejects a time point with neither date nor dateTime", () => {
    expect(() =>
      parseCalendarEvent({ summary: "x", start: {}, end: good.end })
    ).toThrow(/must have a date or dateTime/);
  });
});

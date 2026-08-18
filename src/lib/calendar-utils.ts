import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  startOfDay,
  endOfDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
} from "date-fns";

export type CalendarView = "month" | "week" | "day" | "agenda";

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  allDay: boolean;
  colorId?: string;
}

export interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  status?: string;
  colorId?: string;
}

export function normalizeEvent(e: GoogleCalendarEvent): CalendarEvent {
  const allDay = !e.start.dateTime;
  return {
    id: e.id,
    summary: e.summary || "(No title)",
    description: e.description,
    location: e.location,
    start: e.start.dateTime || e.start.date!,
    end: e.end.dateTime || e.end.date!,
    allDay,
    colorId: e.colorId,
  };
}

export function getMonthDays(date: Date): Date[] {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  return eachDayOfInterval({ start: calStart, end: calEnd });
}

export function getWeekDays(date: Date): Date[] {
  const weekStart = startOfWeek(date);
  const weekEnd = endOfWeek(weekStart);
  return eachDayOfInterval({ start: weekStart, end: weekEnd });
}

export function getViewRange(
  date: Date,
  view: CalendarView
): { timeMin: string; timeMax: string } {
  let start: Date;
  let end: Date;

  switch (view) {
    case "month": {
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      start = startOfWeek(monthStart);
      end = endOfWeek(monthEnd);
      break;
    }
    case "week":
      start = startOfWeek(date);
      end = endOfWeek(date);
      break;
    case "day":
      start = startOfDay(date);
      end = endOfDay(date);
      break;
    case "agenda":
      start = startOfDay(date);
      end = addDays(start, 14);
      break;
  }

  return {
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
  };
}

export function navigateDate(
  date: Date,
  view: CalendarView,
  direction: "prev" | "next"
): Date {
  const add = direction === "next";
  switch (view) {
    case "month":
      return add ? addMonths(date, 1) : subMonths(date, 1);
    case "week":
      return add ? addWeeks(date, 1) : subWeeks(date, 1);
    case "day":
    case "agenda":
      return add ? addDays(date, 1) : subDays(date, 1);
  }
}

export function getEventsForDay(
  events: CalendarEvent[],
  day: Date
): CalendarEvent[] {
  return events.filter((e) => {
    const eventStart = parseISO(e.start);
    const eventEnd = parseISO(e.end);
    const dayStart = startOfDay(day);
    const dayEnd = endOfDay(day);
    return eventStart < dayEnd && eventEnd > dayStart;
  });
}

export function getEventTime(event: CalendarEvent): string {
  if (event.allDay) return "All day";
  return format(parseISO(event.start), "h:mm a");
}

export const HOURS = Array.from({ length: 24 }, (_, i) => i);

export { format, isSameDay, isSameMonth, isToday, parseISO };

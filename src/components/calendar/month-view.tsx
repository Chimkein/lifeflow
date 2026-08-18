"use client";

import {
  getMonthDays,
  getEventsForDay,
  getEventTime,
  isSameMonth,
  isToday,
  format,
  type CalendarEvent,
} from "@/lib/calendar-utils";

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onDayClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const EVENT_COLORS: Record<string, string> = {
  "1": "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  "2": "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  "3": "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  "4": "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  "5": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  default: "bg-gold/15 text-gold-foreground",
};

function getEventColor(colorId?: string): string {
  return EVENT_COLORS[colorId || ""] || EVENT_COLORS.default;
}

export function MonthView({
  currentDate,
  events,
  onDayClick,
  onEventClick,
}: MonthViewProps) {
  const days = getMonthDays(currentDate);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid grid-cols-7 border-b border-border">
        {DAY_NAMES.map((day) => (
          <div
            key={day}
            className="px-2 py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const dayEvents = getEventsForDay(events, day);
          const inMonth = isSameMonth(day, currentDate);
          const today = isToday(day);

          return (
            <div
              key={i}
              onClick={() => onDayClick(day)}
              className={`min-h-[100px] cursor-pointer border-b border-r border-border p-1.5 transition-colors hover:bg-muted/50 ${
                !inMonth ? "bg-muted/30" : ""
              } ${i % 7 === 6 ? "border-r-0" : ""}`}
            >
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  today
                    ? "bg-gold font-semibold text-gold-foreground"
                    : inMonth
                      ? "text-foreground"
                      : "text-muted-foreground/50"
                }`}
              >
                {format(day, "d")}
              </span>
              <div className="mt-0.5 space-y-0.5">
                {dayEvents.slice(0, 3).map((event) => (
                  <button
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                    className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] leading-tight ${getEventColor(event.colorId)}`}
                  >
                    {event.allDay ? "" : `${getEventTime(event)} `}
                    {event.summary}
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <span className="block px-1.5 text-[10px] text-muted-foreground">
                    +{dayEvents.length - 3} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

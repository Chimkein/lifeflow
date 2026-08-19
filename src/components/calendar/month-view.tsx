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
  "1": "bg-info/15 text-info",
  "2": "bg-success/15 text-success",
  "3": "bg-primary/15 text-primary",
  "4": "bg-destructive/15 text-destructive",
  "5": "bg-warning/15 text-warning",
  default: "bg-primary/15 text-primary",
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
              className={`min-h-16 cursor-pointer border-b border-r border-border p-1 transition-colors hover:bg-muted/50 sm:min-h-[100px] sm:p-1.5 ${
                !inMonth ? "bg-muted/30" : ""
              } ${i % 7 === 6 ? "border-r-0" : ""}`}
            >
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  today
                    ? "bg-primary font-semibold text-primary-foreground"
                    : inMonth
                      ? "text-foreground"
                      : "text-muted-foreground/50"
                }`}
              >
                {format(day, "d")}
              </span>
              {/* Phones: dots only; tap drills into the day view */}
              {dayEvents.length > 0 && (
                <div className="mt-1 flex justify-center gap-0.5 sm:hidden">
                  {dayEvents.slice(0, 3).map((event) => (
                    <span
                      key={event.id}
                      className="size-1.5 rounded-full bg-primary"
                    />
                  ))}
                </div>
              )}
              <div className="mt-0.5 hidden space-y-0.5 sm:block">
                {dayEvents.slice(0, 3).map((event) => (
                  <button
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                    className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-xs leading-tight ${getEventColor(event.colorId)}`}
                  >
                    {event.allDay ? "" : `${getEventTime(event)} `}
                    {event.summary}
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <span className="block px-1.5 text-xs text-muted-foreground">
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

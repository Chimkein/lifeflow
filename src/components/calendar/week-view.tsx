"use client";

import {
  getWeekDays,
  getEventsForDay,
  HOURS,
  isToday,
  format,
  parseISO,
  type CalendarEvent,
} from "@/lib/calendar-utils";

interface WeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onTimeClick: (date: Date, hour: number) => void;
  onEventClick: (event: CalendarEvent) => void;
}

function getEventPosition(event: CalendarEvent) {
  const start = parseISO(event.start);
  const top = start.getHours() * 60 + start.getMinutes();
  const end = parseISO(event.end);
  const height = Math.max(
    (end.getTime() - start.getTime()) / 60000,
    20
  );
  return { top, height };
}

export function WeekView({
  currentDate,
  events,
  onTimeClick,
  onEventClick,
}: WeekViewProps) {
  const days = getWeekDays(currentDate);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border">
        <div className="border-r border-border" />
        {days.map((day, i) => (
          <div
            key={i}
            className={`border-r border-border px-2 py-2 text-center last:border-r-0 ${
              isToday(day) ? "bg-primary/8" : ""
            }`}
          >
            <div className="text-xs text-muted-foreground">
              {format(day, "EEE")}
            </div>
            <div
              className={`text-sm font-medium ${
                isToday(day) ? "text-primary" : ""
              }`}
            >
              {format(day, "d")}
            </div>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div className="max-h-[600px] overflow-y-auto">
        <div className="grid grid-cols-[60px_repeat(7,1fr)]">
          {/* Time labels */}
          <div>
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="flex h-[60px] items-start justify-end border-b border-r border-border pr-2 pt-0.5 text-xs text-muted-foreground"
              >
                {hour === 0 ? "" : format(new Date(2000, 0, 1, hour), "h a")}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, dayIdx) => {
            const dayEvents = getEventsForDay(events, day).filter(
              (e) => !e.allDay
            );

            return (
              <div key={dayIdx} className="relative border-r last:border-r-0">
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    onClick={() => onTimeClick(day, hour)}
                    className="h-[60px] cursor-pointer border-b border-border transition-colors hover:bg-muted/30"
                  />
                ))}
                {/* Events */}
                {dayEvents.map((event) => {
                  const { top, height } = getEventPosition(event);
                  return (
                    <button
                      key={event.id}
                      onClick={() => onEventClick(event)}
                      className="absolute left-0.5 right-0.5 overflow-hidden rounded bg-primary/15 px-1 py-0.5 text-left text-xs leading-tight text-foreground hover:bg-primary/25"
                      style={{ top: `${top}px`, height: `${height}px` }}
                    >
                      <span className="font-medium">{event.summary}</span>
                      <br />
                      <span className="text-muted-foreground">
                        {format(parseISO(event.start), "h:mm a")}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

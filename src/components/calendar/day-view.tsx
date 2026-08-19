"use client";

import {
  getEventsForDay,
  HOURS,
  format,
  parseISO,
  type CalendarEvent,
} from "@/lib/calendar-utils";

interface DayViewProps {
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

export function DayView({
  currentDate,
  events,
  onTimeClick,
  onEventClick,
}: DayViewProps) {
  const dayEvents = getEventsForDay(events, currentDate);
  const allDayEvents = dayEvents.filter((e) => e.allDay);
  const timedEvents = dayEvents.filter((e) => !e.allDay);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div className="border-b border-border p-2">
          <span className="mr-2 text-xs text-muted-foreground">All day</span>
          {allDayEvents.map((event) => (
            <button
              key={event.id}
              onClick={() => onEventClick(event)}
              className="mr-1 rounded bg-primary/15 px-2 py-0.5 text-xs text-foreground hover:bg-primary/25"
            >
              {event.summary}
            </button>
          ))}
        </div>
      )}

      {/* Time grid */}
      <div className="max-h-[600px] overflow-y-auto">
        <div className="relative grid grid-cols-[60px_1fr]">
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

          {/* Events column */}
          <div className="relative">
            {HOURS.map((hour) => (
              <div
                key={hour}
                onClick={() => onTimeClick(currentDate, hour)}
                className="h-[60px] cursor-pointer border-b border-border transition-colors hover:bg-muted/30"
              />
            ))}
            {timedEvents.map((event) => {
              const { top, height } = getEventPosition(event);
              return (
                <button
                  key={event.id}
                  onClick={() => onEventClick(event)}
                  className="absolute left-1 right-4 overflow-hidden rounded bg-primary/15 px-2 py-1 text-left text-xs leading-tight text-foreground hover:bg-primary/25"
                  style={{ top: `${top}px`, height: `${height}px` }}
                >
                  <span className="font-medium">{event.summary}</span>
                  <br />
                  <span className="text-muted-foreground">
                    {format(parseISO(event.start), "h:mm a")} –{" "}
                    {format(parseISO(event.end), "h:mm a")}
                  </span>
                  {event.location && (
                    <>
                      <br />
                      <span className="text-muted-foreground">
                        {event.location}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

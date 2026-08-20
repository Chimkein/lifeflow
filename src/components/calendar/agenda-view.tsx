"use client";

import {
  format,
  parseISO,
  isToday,
  isSameDay,
  type CalendarEvent,
} from "@/lib/calendar-utils";
import { Calendar, MapPin, Clock } from "lucide-react";

interface AgendaViewProps {
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}

export function AgendaView({ events, onEventClick }: AgendaViewProps) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Calendar className="h-7 w-7 text-primary" />
        </div>
        <p className="font-heading text-lg font-semibold">A clear fortnight</p>
        <p className="mt-1 text-sm text-muted-foreground">
          No events in the next two weeks.
        </p>
      </div>
    );
  }

  const grouped: { date: Date; events: CalendarEvent[] }[] = [];
  for (const event of events) {
    const eventDate = parseISO(event.start);
    const last = grouped[grouped.length - 1];
    if (last && isSameDay(last.date, eventDate)) {
      last.events.push(event);
    } else {
      grouped.push({ date: eventDate, events: [event] });
    }
  }

  return (
    <div className="space-y-4">
      {grouped.map(({ date, events: dayEvents }, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm"
        >
          <div
            className={`border-b border-border px-4 py-2 ${
              isToday(date) ? "bg-primary/8" : "bg-muted/30"
            }`}
          >
            <span className="text-sm font-medium">
              {isToday(date) ? "Today" : format(date, "EEEE")},{" "}
              {format(date, "MMM d")}
            </span>
          </div>
          <div className="divide-y divide-border">
            {dayEvents.map((event) => (
              <button
                key={event.id}
                onClick={() => onEventClick(event)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
              >
                <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{event.summary}</p>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {event.allDay
                        ? "All day"
                        : `${format(parseISO(event.start), "h:mm a")} – ${format(parseISO(event.end), "h:mm a")}`}
                    </span>
                    {event.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {event.location}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

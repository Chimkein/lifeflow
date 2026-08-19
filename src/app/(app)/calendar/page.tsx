"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { CalendarHeader } from "@/components/calendar/calendar-header";
import { MonthView } from "@/components/calendar/month-view";
import { WeekView } from "@/components/calendar/week-view";
import { DayView } from "@/components/calendar/day-view";
import { AgendaView } from "@/components/calendar/agenda-view";
import {
  EventDialog,
  type EventFormData,
} from "@/components/calendar/event-dialog";
import {
  type CalendarView,
  type CalendarEvent,
  normalizeEvent,
  navigateDate,
  getViewRange,
} from "@/lib/calendar-utils";
import { Skeleton } from "@/components/ui/skeleton";

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>("month");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const appliedMobileDefault = useRef(false);

  // On phones, start in the agenda view — month/week grids don't fit.
  // Effect-based so SSR and first client render stay in sync.
  useEffect(() => {
    if (appliedMobileDefault.current) return;
    appliedMobileDefault.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mobile default; effect keeps SSR and first client render in sync
    if (window.innerWidth < 768) setView("agenda");
  }, []);

  // Week view is desktop-only; fall back to the day grid when narrow.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- week view is desktop-only; collapse to day when the viewport becomes narrow
    if (isMobile && view === "week") setView("day");
  }, [isMobile, view]);

  // Event dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | null>(null);
  const [defaultHour, setDefaultHour] = useState<number>(9);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { timeMin, timeMax } = getViewRange(currentDate, view);
      const res = await fetch(
        `/api/calendar/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`
      );
      const data = await res.json();

      if (!res.ok) {
        if (data.error === "REAUTH_REQUIRED") {
          setError("Your Google session has expired. Please sign out and sign in again.");
        } else if (data.error === "NO_GOOGLE_ACCOUNT") {
          setError("No Google account connected. Please sign out and sign in again.");
        } else {
          setError(data.error || "Failed to load events");
        }
        return;
      }

      setEvents(data.events.map(normalizeEvent));
    } catch {
      setError("Failed to connect to the server");
    } finally {
      setLoading(false);
    }
  }, [currentDate, view]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { timeMin, timeMax } = getViewRange(currentDate, view);
        const res = await fetch(
          `/api/calendar/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`
        );
        if (cancelled) return;
        const data = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          if (data.error === "REAUTH_REQUIRED") {
            setError("Your Google session has expired. Please sign out and sign in again.");
          } else if (data.error === "NO_GOOGLE_ACCOUNT") {
            setError("No Google account connected. Please sign out and sign in again.");
          } else {
            setError(data.error || "Failed to load events");
          }
          return;
        }

        setEvents(data.events.map(normalizeEvent));
      } catch {
        if (!cancelled) setError("Failed to connect to the server");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentDate, view]);

  const handleNavigate = (direction: "prev" | "next") => {
    setCurrentDate((d) => navigateDate(d, view, direction));
  };

  const handleToday = () => setCurrentDate(new Date());

  const handleDayClick = (date: Date) => {
    if (isMobile) {
      // Month cells only show dots on phones — drill into the day instead.
      setCurrentDate(date);
      setView("day");
      return;
    }
    setEditingEvent(null);
    setDefaultDate(date);
    setDefaultHour(9);
    setDialogOpen(true);
  };

  const handleTimeClick = (date: Date, hour: number) => {
    setEditingEvent(null);
    setDefaultDate(date);
    setDefaultHour(hour);
    setDialogOpen(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setEditingEvent(event);
    setDefaultDate(null);
    setDialogOpen(true);
  };

  const handleNewEvent = () => {
    setEditingEvent(null);
    setDefaultDate(currentDate);
    setDefaultHour(9);
    setDialogOpen(true);
  };

  const handleSave = async (form: EventFormData) => {
    const body = form.allDay
      ? {
          summary: form.summary,
          description: form.description || undefined,
          location: form.location || undefined,
          start: { date: form.startDate },
          end: { date: form.endDate },
        }
      : {
          summary: form.summary,
          description: form.description || undefined,
          location: form.location || undefined,
          start: {
            dateTime: new Date(
              `${form.startDate}T${form.startTime}`
            ).toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          end: {
            dateTime: new Date(
              `${form.endDate}T${form.endTime}`
            ).toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        };

    if (editingEvent) {
      await fetch(`/api/calendar/events/${editingEvent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    await fetchEvents();
  };

  const handleDelete = async (eventId: string) => {
    await fetch(`/api/calendar/events/${eventId}`, { method: "DELETE" });
    await fetchEvents();
  };

  return (
    <div className="space-y-4">
      <CalendarHeader
        currentDate={currentDate}
        view={view}
        onNavigate={handleNavigate}
        onToday={handleToday}
        onViewChange={setView}
        onNewEvent={handleNewEvent}
      />

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-[400px] w-full rounded-xl" />
        </div>
      ) : (
        <>
          {view === "month" && (
            <MonthView
              currentDate={currentDate}
              events={events}
              onDayClick={handleDayClick}
              onEventClick={handleEventClick}
            />
          )}
          {view === "week" && (
            <WeekView
              currentDate={currentDate}
              events={events}
              onTimeClick={handleTimeClick}
              onEventClick={handleEventClick}
            />
          )}
          {view === "day" && (
            <DayView
              currentDate={currentDate}
              events={events}
              onTimeClick={handleTimeClick}
              onEventClick={handleEventClick}
            />
          )}
          {view === "agenda" && (
            <AgendaView
              events={events}
              onEventClick={handleEventClick}
            />
          )}
        </>
      )}

      <EventDialog
        key={editingEvent?.id ?? defaultDate?.toISOString() ?? "new"}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        event={editingEvent}
        defaultDate={defaultDate}
        defaultHour={defaultHour}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}

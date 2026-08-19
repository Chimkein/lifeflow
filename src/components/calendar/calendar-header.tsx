"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import type { CalendarView } from "@/lib/calendar-utils";

const VIEWS: { value: CalendarView; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "day", label: "Day" },
  { value: "agenda", label: "Agenda" },
];

interface CalendarHeaderProps {
  currentDate: Date;
  view: CalendarView;
  onNavigate: (direction: "prev" | "next") => void;
  onToday: () => void;
  onViewChange: (view: CalendarView) => void;
  onNewEvent: () => void;
}

function getTitle(date: Date, view: CalendarView): string {
  switch (view) {
    case "month":
      return format(date, "MMMM yyyy");
    case "week":
      return format(date, "MMM d, yyyy");
    case "day":
      return format(date, "EEEE, MMM d, yyyy");
    case "agenda":
      return `Agenda — ${format(date, "MMM d, yyyy")}`;
  }
}

export function CalendarHeader({
  currentDate,
  view,
  onNavigate,
  onToday,
  onViewChange,
  onNewEvent,
}: CalendarHeaderProps) {
  const isMobile = useIsMobile();
  const views = isMobile ? VIEWS.filter((v) => v.value !== "week") : VIEWS;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold sm:text-lg">
          {getTitle(currentDate, view)}
        </h2>
        <Button
          size="sm"
          onClick={onNewEvent}
          aria-label="New event"
          className="shrink-0 gap-1.5"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Event</span>
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous"
            onClick={() => onNavigate("prev")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next"
            onClick={() => onNavigate("next")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={onToday}>
            Today
          </Button>
        </div>

        <div className="flex rounded-lg border border-border">
          {views.map((v) => (
            <button
              key={v.value}
              onClick={() => onViewChange(v.value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors first:rounded-l-lg last:rounded-r-lg pointer-coarse:min-h-11 ${
                view === v.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

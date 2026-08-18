"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
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
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate("prev")}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate("next")}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={onToday} className="h-8">
          Today
        </Button>
        <h2 className="ml-2 text-lg font-semibold">
          {getTitle(currentDate, view)}
        </h2>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex rounded-lg border border-border">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              onClick={() => onViewChange(v.value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
                view === v.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={onNewEvent} className="h-8">
          + New Event
        </Button>
      </div>
    </div>
  );
}

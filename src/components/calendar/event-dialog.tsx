"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import type { CalendarEvent } from "@/lib/calendar-utils";

interface EventDialogProps {
  open: boolean;
  onClose: () => void;
  event?: CalendarEvent | null;
  defaultDate?: Date | null;
  defaultHour?: number;
  onSave: (data: EventFormData) => Promise<void>;
  onDelete?: (eventId: string) => Promise<void>;
}

export interface EventFormData {
  summary: string;
  description: string;
  location: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  allDay: boolean;
}

function toLocalDate(iso: string): string {
  const d = new Date(iso);
  return format(d, "yyyy-MM-dd");
}

function toLocalTime(iso: string): string {
  const d = new Date(iso);
  return format(d, "HH:mm");
}

export function EventDialog({
  open,
  onClose,
  event,
  defaultDate,
  defaultHour,
  onSave,
  onDelete,
}: EventDialogProps) {
  const [form, setForm] = useState<EventFormData>({
    summary: "",
    description: "",
    location: "",
    startDate: format(new Date(), "yyyy-MM-dd"),
    startTime: "09:00",
    endDate: format(new Date(), "yyyy-MM-dd"),
    endTime: "10:00",
    allDay: false,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (event) {
      setForm({
        summary: event.summary,
        description: event.description || "",
        location: event.location || "",
        startDate: toLocalDate(event.start),
        startTime: event.allDay ? "09:00" : toLocalTime(event.start),
        endDate: toLocalDate(event.end),
        endTime: event.allDay ? "10:00" : toLocalTime(event.end),
        allDay: event.allDay,
      });
    } else if (defaultDate) {
      const dateStr = format(defaultDate, "yyyy-MM-dd");
      const hour = defaultHour ?? 9;
      setForm({
        summary: "",
        description: "",
        location: "",
        startDate: dateStr,
        startTime: `${String(hour).padStart(2, "0")}:00`,
        endDate: dateStr,
        endTime: `${String(hour + 1).padStart(2, "0")}:00`,
        allDay: false,
      });
    }
  }, [event, defaultDate, defaultHour]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.summary.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event || !onDelete) return;
    setDeleting(true);
    try {
      await onDelete(event.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  const update = (field: keyof EventFormData, value: string | boolean) =>
    setForm((f) => ({ ...f, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{event ? "Edit Event" : "New Event"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="Event title"
            value={form.summary}
            onChange={(e) => update("summary", e.target.value)}
            autoFocus
          />

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.allDay}
              onChange={(e) => update("allDay", e.target.checked)}
              className="rounded"
            />
            All day
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Start date
              </label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => update("startDate", e.target.value)}
              />
            </div>
            {!form.allDay && (
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Start time
                </label>
                <Input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => update("startTime", e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                End date
              </label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => update("endDate", e.target.value)}
              />
            </div>
            {!form.allDay && (
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  End time
                </label>
                <Input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => update("endTime", e.target.value)}
                />
              </div>
            )}
          </div>

          <Input
            placeholder="Location (optional)"
            value={form.location}
            onChange={(e) => update("location", e.target.value)}
          />

          <Textarea
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            rows={3}
          />

          <div className="flex justify-between">
            {event && onDelete ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "Saving..." : event ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  LinkPicker,
  type LinkableItem,
} from "@/components/shared/link-picker";
import { useTimezone } from "@/components/timezone-provider";
import { zonedParts } from "@/lib/timezone";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Split a stored instant into the user's local date + time inputs. A local
// midnight is treated as an all-day task (no time), matching how the app
// renders and stores date-only tasks.
function splitDue(
  iso: string | null,
  tz: string
): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const { year, month, day, hour, minute } = zonedParts(new Date(iso), tz);
  const date = `${year}-${pad(month)}-${pad(day)}`;
  const time = hour === 0 && minute === 0 ? "" : `${pad(hour)}:${pad(minute)}`;
  return { date, time };
}

export interface LinkedNote {
  taskId: string;
  noteId: string;
  note: { id: string; title: string };
}

export interface TaskData {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  taskNotes?: LinkedNote[];
}

export interface TaskFormData {
  title: string;
  description: string;
  priority: string;
  dueAt: string;
}

interface TaskDialogProps {
  open: boolean;
  onClose: () => void;
  task?: TaskData | null;
  onSave: (data: TaskFormData) => Promise<void>;
  onDelete?: (taskId: string) => Promise<void>;
}

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export function TaskDialog({
  open,
  onClose,
  task,
  onSave,
  onDelete,
}: TaskDialogProps) {
  const tz = useTimezone();
  const initialDue = splitDue(task?.dueAt ?? null, tz);
  const [form, setForm] = useState({
    title: task?.title ?? "",
    description: task?.description ?? "",
    priority: task?.priority ?? "medium",
  });
  const [dueDate, setDueDate] = useState(initialDue.date);
  const [dueTime, setDueTime] = useState(initialDue.time);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [linkedNotes, setLinkedNotes] = useState<LinkableItem[]>(
    () =>
      task?.taskNotes?.map((tn) => ({
        id: tn.note.id,
        title: tn.note.title,
      })) ?? []
  );

  const handleLinkNote = async (noteId: string) => {
    if (!task) return;
    const res = await fetch("/api/links/task-note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id, noteId }),
    });
    if (res.ok) {
      const noteRes = await fetch(`/api/notes/${noteId}`);
      const data = await noteRes.json();
      if (data.note) {
        setLinkedNotes((prev) => [
          ...prev,
          { id: data.note.id, title: data.note.title },
        ]);
      }
    }
  };

  const handleUnlinkNote = async (noteId: string) => {
    if (!task) return;
    await fetch("/api/links/task-note", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id, noteId }),
    });
    setLinkedNotes((prev) => prev.filter((n) => n.id !== noteId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    // Combine into a naive local wall-clock string; the server anchors it to
    // the user's timezone. Time without a date is ignored.
    const dueAt = dueDate ? (dueTime ? `${dueDate}T${dueTime}` : dueDate) : "";
    setSaving(true);
    try {
      await onSave({ ...form, dueAt });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!task || !onDelete) return;
    setDeleting(true);
    try {
      await onDelete(task.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{task ? "Edit Task" : "New Task"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="Task title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            autoFocus
          />

          <Textarea
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            rows={3}
            className="resize-none"
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Priority
              </label>
              <div className="flex rounded-xl border border-border bg-muted/50 p-1">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, priority: p.value }))
                    }
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-all pointer-coarse:min-h-10 ${
                      form.priority === p.value
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Due date &amp; time
              </label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDueDate(v);
                    if (!v) setDueTime(""); // clearing the date clears the time
                  }}
                  className="flex-1"
                />
                <Input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  disabled={!dueDate}
                  className="w-[7.5rem]"
                  aria-label="Due time (optional)"
                />
              </div>
            </div>
          </div>

          {task && (
            <LinkPicker
              type="note"
              linkedItems={linkedNotes}
              onLink={handleLinkNote}
              onUnlink={handleUnlinkNote}
            />
          )}

          <div className="flex justify-between">
            {task && onDelete ? (
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
                {saving ? "Saving..." : task ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

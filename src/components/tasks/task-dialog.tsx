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
  const [form, setForm] = useState<TaskFormData>({
    title: task?.title ?? "",
    description: task?.description ?? "",
    priority: task?.priority ?? "medium",
    dueAt: task?.dueAt ? task.dueAt.slice(0, 10) : "",
  });
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
    setSaving(true);
    try {
      await onSave(form);
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Priority
              </label>
              <div className="flex rounded-lg border border-border">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, priority: p.value }))
                    }
                    className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
                      form.priority === p.value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Due date
              </label>
              <Input
                type="date"
                value={form.dueAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dueAt: e.target.value }))
                }
              />
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

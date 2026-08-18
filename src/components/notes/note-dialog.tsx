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
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import {
  LinkPicker,
  type LinkableItem,
} from "@/components/shared/link-picker";

export interface LinkedTask {
  taskId: string;
  noteId: string;
  task: { id: string; title: string; status: string; priority: string };
}

export interface NoteData {
  id: string;
  title: string;
  content: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tags: { id: string; tag: string }[];
  taskNotes?: LinkedTask[];
}

export interface NoteFormData {
  title: string;
  content: string;
  tags: string[];
}

interface NoteDialogProps {
  open: boolean;
  onClose: () => void;
  note?: NoteData | null;
  onSave: (data: NoteFormData) => Promise<void>;
  onDelete?: (noteId: string) => Promise<void>;
}

export function NoteDialog({
  open,
  onClose,
  note,
  onSave,
  onDelete,
}: NoteDialogProps) {
  const [form, setForm] = useState<NoteFormData>({
    title: note?.title ?? "",
    content: note?.content ?? "",
    tags: note?.tags.map((t) => t.tag) ?? [],
  });
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [linkedTasks, setLinkedTasks] = useState<LinkableItem[]>(
    () =>
      note?.taskNotes?.map((tn) => ({
        id: tn.task.id,
        title: tn.task.title,
        status: tn.task.status,
        priority: tn.task.priority,
      })) ?? []
  );

  const handleLinkTask = async (taskId: string) => {
    if (!note) return;
    const res = await fetch("/api/links/task-note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, noteId: note.id }),
    });
    if (res.ok) {
      const taskRes = await fetch(`/api/tasks/${taskId}`);
      const data = await taskRes.json();
      if (data.task) {
        setLinkedTasks((prev) => [
          ...prev,
          {
            id: data.task.id,
            title: data.task.title,
            status: data.task.status,
            priority: data.task.priority,
          },
        ]);
      }
    }
  };

  const handleUnlinkTask = async (taskId: string) => {
    if (!note) return;
    await fetch("/api/links/task-note", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, noteId: note.id }),
    });
    setLinkedTasks((prev) => prev.filter((t) => t.id !== taskId));
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
    if (!note || !onDelete) return;
    setDeleting(true);
    try {
      await onDelete(note.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !form.tags.includes(t)) {
      setForm((f) => ({ ...f, tags: [...f.tags, t] }));
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{note ? "Edit Note" : "New Note"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="Note title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            autoFocus
          />

          <Textarea
            placeholder="Write your note..."
            value={form.content}
            onChange={(e) =>
              setForm((f) => ({ ...f, content: e.target.value }))
            }
            rows={8}
            className="resize-none"
          />

          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">
              Tags
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="Add a tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addTag}
                disabled={!tagInput.trim()}
              >
                Add
              </Button>
            </div>
            {form.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {form.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="gap-1 pr-1"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {note && (
            <LinkPicker
              type="task"
              linkedItems={linkedTasks}
              onLink={handleLinkTask}
              onUnlink={handleUnlinkTask}
            />
          )}

          <div className="flex justify-between">
            {note && onDelete ? (
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
                {saving ? "Saving..." : note ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

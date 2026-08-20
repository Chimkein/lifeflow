"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskCard } from "@/components/tasks/task-card";
import {
  TaskDialog,
  type TaskData,
  type TaskFormData,
} from "@/components/tasks/task-dialog";
import { Plus, CheckSquare } from "lucide-react";

type StatusFilter = "all" | "pending" | "completed";
type PriorityFilter = "all" | "low" | "medium" | "high" | "urgent";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Active" },
  { value: "completed", label: "Done" },
];

const PRIORITY_TABS: { value: PriorityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [priorityFilter, setPriorityFilter] =
    useState<PriorityFilter>("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskData | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      const res = await fetch(`/api/tasks?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load tasks");
        return;
      }
      setTasks(data.tasks);
    } catch {
      setError("Failed to connect to the server");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (priorityFilter !== "all")
          params.set("priority", priorityFilter);
        const res = await fetch(`/api/tasks?${params}`);
        if (cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "Failed to load tasks");
          return;
        }
        setTasks(data.tasks);
      } catch {
        if (!cancelled) setError("Failed to connect to the server");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [statusFilter, priorityFilter]);

  const handleNewTask = () => {
    setEditingTask(null);
    setDialogOpen(true);
  };

  const handleTaskClick = (task: TaskData) => {
    setEditingTask(task);
    setDialogOpen(true);
  };

  const handleSave = async (form: TaskFormData) => {
    const body = {
      title: form.title,
      description: form.description || undefined,
      priority: form.priority,
      dueAt: form.dueAt || null,
    };

    const res = editingTask
      ? await fetch(`/api/tasks/${editingTask.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      : await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
    if (res.ok) {
      toast.success(editingTask ? "Task updated" : "Task created");
      await fetchTasks();
    } else {
      toast.error("Couldn't save the task");
    }
  };

  const handleDelete = async (taskId: string) => {
    const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Task deleted");
      await fetchTasks();
    } else {
      toast.error("Couldn't delete the task");
    }
  };

  const handleToggle = async (task: TaskData) => {
    const newStatus =
      task.status === "completed" ? "pending" : "completed";
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    await fetchTasks();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Tasks
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Track and manage your work
          </p>
        </div>
        <Button onClick={handleNewTask}>
          <Plus className="h-4 w-4" />
          New Task
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full rounded-xl border border-border bg-card p-1 shadow-sm sm:w-auto">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setStatusFilter(t.value)}
              className={`flex-1 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all pointer-coarse:min-h-10 sm:flex-initial ${
                statusFilter === t.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex max-w-full overflow-x-auto rounded-xl border border-border bg-card p-1 shadow-sm">
          {PRIORITY_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setPriorityFilter(t.value)}
              className={`shrink-0 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all pointer-coarse:min-h-10 ${
                priorityFilter === t.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[84px] rounded-2xl" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <CheckSquare className="h-7 w-7 text-primary" />
          </div>
          <p className="font-heading text-lg font-semibold">
            {statusFilter !== "all" || priorityFilter !== "all"
              ? "No tasks match your filters"
              : "No tasks yet"}
          </p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            {statusFilter !== "all" || priorityFilter !== "all"
              ? "Try a different filter, or add something new."
              : "Add your first task and keep everything in one calm place."}
          </p>
          {statusFilter === "all" && priorityFilter === "all" && (
            <Button className="mt-5" onClick={handleNewTask}>
              <Plus className="h-4 w-4" />
              Create your first task
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={handleTaskClick}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}

      <TaskDialog
        key={editingTask?.id ?? "new"}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        task={editingTask}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}

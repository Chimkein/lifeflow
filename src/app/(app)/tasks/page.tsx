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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Track and manage your work
          </p>
        </div>
        <Button size="sm" onClick={handleNewTask}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          New Task
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full rounded-lg border border-border sm:w-auto">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setStatusFilter(t.value)}
              className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors first:rounded-l-lg last:rounded-r-lg pointer-coarse:min-h-11 sm:flex-initial ${
                statusFilter === t.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex max-w-full overflow-x-auto rounded-lg border border-border">
          {PRIORITY_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setPriorityFilter(t.value)}
              className={`shrink-0 whitespace-nowrap px-3 py-1.5 text-xs font-medium transition-colors first:rounded-l-lg last:rounded-r-lg pointer-coarse:min-h-11 ${
                priorityFilter === t.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[80px] rounded-xl" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CheckSquare className="mb-3 h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            {statusFilter !== "all" || priorityFilter !== "all"
              ? "No tasks match your filters"
              : "No tasks yet"}
          </p>
          {statusFilter === "all" && priorityFilter === "all" && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={handleNewTask}
            >
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

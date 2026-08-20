"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, ArrowUpRight } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { cn } from "@/lib/utils";

export interface DashboardTask {
  id: string;
  title: string;
  priority: string;
  dueAt: string | null;
  createdAt: string;
}

type SortKey = "due" | "priority" | "added";

const PRIORITY_RANK: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-info/12 text-info",
  high: "bg-warning/15 text-warning",
  urgent: "bg-destructive/12 text-destructive",
};

function byDue(a: DashboardTask, b: DashboardTask) {
  if (!a.dueAt && !b.dueAt) return 0;
  if (!a.dueAt) return 1;
  if (!b.dueAt) return -1;
  return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
}

const LIMIT = 5;

export function DashboardTasks({
  tasks,
  openCount,
}: {
  tasks: DashboardTask[];
  openCount: number;
}) {
  const [sort, setSort] = useState<SortKey>("due");

  const sorted = [...tasks].sort((a, b) => {
    if (sort === "added") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (sort === "priority") {
      const rank =
        (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
      if (rank !== 0) return rank;
    }
    return byDue(a, b);
  });

  const shown = sorted.slice(0, LIMIT);
  const remaining = openCount - shown.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="font-heading text-lg">Tasks</CardTitle>
          <Link
            href="/tasks"
            className="text-xs font-medium text-primary hover:underline"
          >
            View all
          </Link>
        </div>
        {tasks.length > 0 && (
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Sort by</span>
            <div className="flex rounded-lg border border-border bg-card/60 p-0.5">
              {(
                [
                  { key: "due", label: "Due date" },
                  { key: "priority", label: "Priority" },
                  { key: "added", label: "Added" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSort(opt.key)}
                  aria-pressed={sort === opt.key}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-medium transition-all pointer-coarse:min-h-9",
                    sort === opt.key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12">
              <CheckSquare className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium">You&apos;re all clear</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Add a task to start tracking your work.
            </p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {shown.map((task) => {
              const due = task.dueAt ? new Date(task.dueAt) : null;
              const overdue = due && isPast(due) && !isToday(due);
              const dueToday = due && isToday(due);
              return (
                <li key={task.id}>
                  <Link
                    href="/tasks"
                    className="group/task flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-accent/50"
                  >
                    <span
                      className="min-w-0 flex-1 truncate text-sm group-hover/task:text-foreground"
                      title={task.title}
                    >
                      {task.title}
                    </span>
                    {due && (
                      <span
                        className={cn(
                          "shrink-0 text-xs font-medium",
                          overdue
                            ? "text-destructive"
                            : dueToday
                              ? "text-warning"
                              : "text-muted-foreground"
                        )}
                      >
                        {overdue ? "Overdue" : dueToday ? "Today" : format(due, "MMM d")}
                      </span>
                    )}
                    <Badge
                      className={cn(
                        "shrink-0 capitalize",
                        PRIORITY_COLORS[task.priority] ?? ""
                      )}
                    >
                      {task.priority}
                    </Badge>
                  </Link>
                </li>
              );
            })}
            {remaining > 0 && (
              <li>
                <Link
                  href="/tasks"
                  className="flex items-center justify-center gap-1 rounded-xl px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                >
                  {remaining} more {remaining === 1 ? "task" : "tasks"}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

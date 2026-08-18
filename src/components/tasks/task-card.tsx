"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, isPast, isToday } from "date-fns";
import { Circle, CheckCircle2, Link2 } from "lucide-react";
import type { TaskData } from "./task-dialog";

interface TaskCardProps {
  task: TaskData;
  onClick: (task: TaskData) => void;
  onToggle: (task: TaskData) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  medium:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export function TaskCard({ task, onClick, onToggle }: TaskCardProps) {
  const isCompleted = task.status === "completed";
  const dueDate = task.dueAt ? new Date(task.dueAt) : null;
  const isOverdue = dueDate && !isCompleted && isPast(dueDate) && !isToday(dueDate);

  return (
    <Card className="border-none shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="flex items-start gap-3 p-4">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(task);
          }}
          className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-gold"
        >
          {isCompleted ? (
            <CheckCircle2 className="h-5 w-5 text-gold" />
          ) : (
            <Circle className="h-5 w-5" />
          )}
        </button>
        <div
          className="min-w-0 flex-1 cursor-pointer"
          onClick={() => onClick(task)}
        >
          <p
            className={`font-medium leading-snug ${isCompleted ? "text-muted-foreground line-through" : ""}`}
          >
            {task.title}
          </p>
          {task.description && (
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
              {task.description}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <Badge
              variant="secondary"
              className={`text-[10px] ${PRIORITY_COLORS[task.priority] ?? ""}`}
            >
              {task.priority}
            </Badge>
            {dueDate && (
              <span
                className={`text-[10px] ${isOverdue ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground"}`}
              >
                {isOverdue ? "Overdue: " : ""}
                {format(dueDate, "MMM d")}
              </span>
            )}
            {(task.taskNotes?.length ?? 0) > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Link2 className="h-3 w-3" />
                {task.taskNotes!.length}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

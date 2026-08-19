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
  low: "bg-muted text-muted-foreground",
  medium: "bg-info/15 text-info",
  high: "bg-warning/15 text-warning",
  urgent: "bg-destructive/15 text-destructive",
};

export function TaskCard({ task, onClick, onToggle }: TaskCardProps) {
  const isCompleted = task.status === "completed";
  const dueDate = task.dueAt ? new Date(task.dueAt) : null;
  const isOverdue = dueDate && !isCompleted && isPast(dueDate) && !isToday(dueDate);
  const isDueToday = dueDate && !isCompleted && isToday(dueDate);

  return (
    <Card className="border-none shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="flex items-start gap-3 p-4">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(task);
          }}
          aria-label={isCompleted ? "Mark as not completed" : "Mark as completed"}
          className="relative mt-0.5 shrink-0 text-muted-foreground transition-colors after:absolute after:-inset-2 hover:text-primary"
        >
          {isCompleted ? (
            <CheckCircle2 className="h-5 w-5 text-success" />
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
              className={`text-xs ${PRIORITY_COLORS[task.priority] ?? ""}`}
            >
              {task.priority}
            </Badge>
            {dueDate && (
              <span
                className={`text-xs ${
                  isOverdue
                    ? "font-medium text-destructive"
                    : isDueToday
                      ? "font-medium text-warning"
                      : "text-muted-foreground"
                }`}
              >
                {isOverdue ? "Overdue: " : isDueToday ? "Due today: " : ""}
                {format(dueDate, "MMM d")}
              </span>
            )}
            {(task.taskNotes?.length ?? 0) > 0 && (
              <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
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

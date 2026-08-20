"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, isPast, isToday } from "date-fns";
import { Circle, CheckCircle2, Link2, CalendarClock } from "lucide-react";
import type { TaskData } from "./task-dialog";

interface TaskCardProps {
  task: TaskData;
  onClick: (task: TaskData) => void;
  onToggle: (task: TaskData) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-info/12 text-info",
  high: "bg-warning/15 text-warning",
  urgent: "bg-destructive/12 text-destructive",
};

export function TaskCard({ task, onClick, onToggle }: TaskCardProps) {
  const isCompleted = task.status === "completed";
  const dueDate = task.dueAt ? new Date(task.dueAt) : null;
  const isOverdue = dueDate && !isCompleted && isPast(dueDate) && !isToday(dueDate);
  const isDueToday = dueDate && !isCompleted && isToday(dueDate);

  return (
    <Card
      size="sm"
      className="group transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
    >
      <CardContent className="flex items-start gap-3.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(task);
          }}
          aria-label={isCompleted ? "Mark as not completed" : "Mark as completed"}
          className="relative mt-0.5 shrink-0 text-muted-foreground/60 transition-colors after:absolute after:-inset-2.5 hover:text-primary"
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
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {task.description}
            </p>
          )}
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Badge
              className={`capitalize ${PRIORITY_COLORS[task.priority] ?? ""}`}
            >
              {task.priority}
            </Badge>
            {dueDate && (
              <span
                className={`flex items-center gap-1 text-xs font-medium ${
                  isOverdue
                    ? "text-destructive"
                    : isDueToday
                      ? "text-warning"
                      : "text-muted-foreground"
                }`}
              >
                <CalendarClock className="h-3.5 w-3.5" />
                {isOverdue ? "Overdue · " : isDueToday ? "Today · " : ""}
                {format(dueDate, "MMM d")}
              </span>
            )}
            {(task.taskNotes?.length ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Link2 className="h-3.5 w-3.5" />
                {task.taskNotes!.length}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

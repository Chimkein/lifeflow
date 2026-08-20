"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Circle, CheckCircle2, Link2, CalendarClock } from "lucide-react";
import type { TaskData } from "./task-dialog";
import { useTimezone } from "@/components/timezone-provider";
import { formatInTZ, zonedYmd, zonedParts } from "@/lib/timezone";

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
  const tz = useTimezone();
  const isCompleted = task.status === "completed";
  const dueDate = task.dueAt ? new Date(task.dueAt) : null;

  let dueLabel: string | null = null;
  let isOverdue = false;
  let isDueToday = false;
  if (dueDate) {
    const todayYmd = zonedYmd(new Date(), tz);
    const dueYmd = zonedYmd(dueDate, tz);
    const { hour, minute } = zonedParts(dueDate, tz);
    const hasTime = hour !== 0 || minute !== 0;
    const timeStr = hasTime
      ? formatInTZ(dueDate, { hour: "numeric", minute: "2-digit", hour12: true }, tz)
      : "";
    const dateStr = formatInTZ(dueDate, { month: "short", day: "numeric" }, tz);
    isOverdue = !isCompleted && dueYmd < todayYmd;
    isDueToday = !isCompleted && dueYmd === todayYmd;
    if (isOverdue) dueLabel = timeStr ? `Overdue · ${dateStr}, ${timeStr}` : `Overdue · ${dateStr}`;
    else if (isDueToday) dueLabel = timeStr ? `Today · ${timeStr}` : "Today";
    else dueLabel = timeStr ? `${dateStr}, ${timeStr}` : dateStr;
  }

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
            {dueLabel && (
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
                {dueLabel}
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

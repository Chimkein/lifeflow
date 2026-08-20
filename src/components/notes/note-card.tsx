"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { NoteData } from "./note-dialog";

interface NoteCardProps {
  note: NoteData;
  onClick: (note: NoteData) => void;
}

export function NoteCard({ note, onClick }: NoteCardProps) {
  return (
    <Card
      size="sm"
      className="group h-full cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
      onClick={() => onClick(note)}
    >
      <CardContent className="flex h-full flex-col">
        <h3 className="font-medium leading-snug transition-colors group-hover:text-primary">
          {note.title}
        </h3>
        {note.content && (
          <p className="mt-1.5 line-clamp-4 text-sm text-muted-foreground">
            {note.content}
          </p>
        )}
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {note.tags.slice(0, 3).map((t) => (
              <Badge key={t.id} variant="secondary" className="text-xs">
                {t.tag}
              </Badge>
            ))}
            {(note.taskNotes?.length ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Link2 className="h-3.5 w-3.5" />
                {note.taskNotes!.length}
              </span>
            )}
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(note.updatedAt), {
              addSuffix: true,
            })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

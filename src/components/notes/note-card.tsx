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
      className="cursor-pointer border-none shadow-sm transition-shadow hover:shadow-md"
      onClick={() => onClick(note)}
    >
      <CardContent className="p-4">
        <h3 className="font-medium leading-snug">{note.title}</h3>
        {note.content && (
          <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
            {note.content}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1">
            {note.tags.map((t) => (
              <Badge key={t.id} variant="secondary" className="text-[10px]">
                {t.tag}
              </Badge>
            ))}
            {(note.taskNotes?.length ?? 0) > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Link2 className="h-3 w-3" />
                {note.taskNotes!.length}
              </span>
            )}
          </div>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(note.updatedAt), {
              addSuffix: true,
            })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

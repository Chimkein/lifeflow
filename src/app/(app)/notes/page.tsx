"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { NoteCard } from "@/components/notes/note-card";
import {
  NoteDialog,
  type NoteData,
  type NoteFormData,
} from "@/components/notes/note-dialog";
import { Plus, Search, StickyNote, Archive } from "lucide-react";

export default function NotesPage() {
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteData | null>(null);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (activeTag) params.set("tag", activeTag);
      if (showArchived) params.set("archived", "true");
      const res = await fetch(`/api/notes?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load notes");
        return;
      }
      setNotes(data.notes);
    } catch {
      setError("Failed to connect to the server");
    } finally {
      setLoading(false);
    }
  }, [search, activeTag, showArchived]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (activeTag) params.set("tag", activeTag);
        if (showArchived) params.set("archived", "true");
        const res = await fetch(`/api/notes?${params}`);
        if (cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "Failed to load notes");
          return;
        }
        setNotes(data.notes);
      } catch {
        if (!cancelled) setError("Failed to connect to the server");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search, activeTag, showArchived]);

  const allTags = Array.from(
    new Set(notes.flatMap((n) => n.tags.map((t) => t.tag)))
  ).sort();

  const handleNewNote = () => {
    setEditingNote(null);
    setDialogOpen(true);
  };

  const handleNoteClick = (note: NoteData) => {
    setEditingNote(note);
    setDialogOpen(true);
  };

  const handleSave = async (form: NoteFormData) => {
    const res = editingNote
      ? await fetch(`/api/notes/${editingNote.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
      : await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
    if (res.ok) {
      toast.success(editingNote ? "Note updated" : "Note created");
      await fetchNotes();
    } else {
      toast.error("Couldn't save the note");
    }
  };

  const handleDelete = async (noteId: string) => {
    const res = await fetch(`/api/notes/${noteId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Note deleted");
      await fetchNotes();
    } else {
      toast.error("Couldn't delete the note");
    }
  };

  const handleArchive = async (noteId: string) => {
    await fetch(`/api/notes/${noteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
    await fetchNotes();
  };


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Notes
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {showArchived ? "Archived notes" : "Your notes and ideas"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showArchived ? "default" : "outline"}
            onClick={() => {
              setShowArchived(!showArchived);
              setActiveTag(null);
            }}
          >
            <Archive className="h-4 w-4" />
            Archived
          </Button>
          {!showArchived && (
            <Button onClick={handleNewNote}>
              <Plus className="h-4 w-4" />
              New Note
            </Button>
          )}
        </div>
      </div>

      {/* Search & tags */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 rounded-xl pl-10 shadow-sm"
          />
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {allTags.map((tag) => (
              <Badge
                key={tag}
                variant={activeTag === tag ? "default" : "secondary"}
                className="cursor-pointer transition-colors"
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[150px] rounded-2xl" />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-success/12">
            <StickyNote className="h-7 w-7 text-success" />
          </div>
          <p className="font-heading text-lg font-semibold">
            {search || activeTag
              ? "No notes match your search"
              : showArchived
                ? "No archived notes"
                : "No notes yet"}
          </p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            {search || activeTag
              ? "Try a different search or tag."
              : showArchived
                ? "Notes you archive will land here."
                : "Capture an idea, a list, or a thought — it'll live here."}
          </p>
          {!search && !activeTag && !showArchived && (
            <Button className="mt-5" onClick={handleNewNote}>
              <Plus className="h-4 w-4" />
              Create your first note
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <NoteCard key={note.id} note={note} onClick={handleNoteClick} />
          ))}
        </div>
      )}

      <NoteDialog
        key={editingNote?.id ?? "new"}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        note={editingNote}
        onSave={handleSave}
        onDelete={showArchived ? handleDelete : handleArchive}
      />
    </div>
  );
}

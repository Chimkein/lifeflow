"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { X, Link2, Search, CheckSquare, StickyNote } from "lucide-react";

export interface LinkableItem {
  id: string;
  title: string;
  status?: string;
  priority?: string;
}

interface LinkPickerProps {
  type: "task" | "note";
  linkedItems: LinkableItem[];
  onLink: (itemId: string) => Promise<void>;
  onUnlink: (itemId: string) => Promise<void>;
}

export function LinkPicker({
  type,
  linkedItems,
  onLink,
  onUnlink,
}: LinkPickerProps) {
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LinkableItem[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const linkedIds = useMemo(
    () => new Set(linkedItems.map((i) => i.id)),
    [linkedItems]
  );

  const searchItems = useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        const endpoint =
          type === "task"
            ? `/api/tasks?status=pending`
            : `/api/notes?search=${encodeURIComponent(q)}`;
        const res = await fetch(endpoint);
        const data = await res.json();
        const items: LinkableItem[] = (
          type === "task" ? data.tasks : data.notes
        )
          .filter((item: LinkableItem) => !linkedIds.has(item.id))
          .filter((item: LinkableItem) =>
            item.title.toLowerCase().includes(q.toLowerCase())
          )
          .slice(0, 5);
        setResults(items);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [type, linkedIds]
  );

  useEffect(() => {
    if (!searching || !query.trim()) {
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchItems(query);
    }, 250);

    return () => clearTimeout(debounceRef.current);
  }, [query, searching, searchItems]);

  const handleLink = async (itemId: string) => {
    await onLink(itemId);
    const linked = results.find((r) => r.id === itemId);
    if (linked) {
      setResults((r) => r.filter((i) => i.id !== itemId));
    }
    setQuery("");
  };

  const Icon = type === "task" ? CheckSquare : StickyNote;
  const label = type === "task" ? "Tasks" : "Notes";

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link2 className="h-3 w-3" />
          Linked {label}
        </label>
        {!searching && (
          <button
            type="button"
            onClick={() => {
              setSearching(true);
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            + Add
          </button>
        )}
      </div>

      {searching && (
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder={`Search ${type}s...`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSearching(false);
                setQuery("");
                setResults([]);
                setResults([]);
              }
            }}
            className="h-8 pl-8 text-xs"
          />
          {(results.length > 0 || loading) && (
            <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
              {loading ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  Searching...
                </div>
              ) : (
                results.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleLink(item.id)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted transition-colors first:rounded-t-md last:rounded-b-md"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{item.title}</span>
                    {item.priority && (
                      <Badge variant="secondary" className="ml-auto text-[10px] shrink-0">
                        {item.priority}
                      </Badge>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {linkedItems.length > 0 ? (
        <div className="space-y-1.5">
          {linkedItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5"
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate text-xs">{item.title}</span>
              {item.status === "completed" && (
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  done
                </Badge>
              )}
              <button
                type="button"
                onClick={() => onUnlink(item.id)}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        !searching && (
          <p className="text-xs text-muted-foreground/60">
            No linked {type}s
          </p>
        )
      )}
    </div>
  );
}

import React from "react";
import { cn } from "@/lib/utils";

// The model occasionally echoes internal identifiers (event/task/note ids) that
// mean nothing to a person — strip them from what we render.
function clean(text: string) {
  return text
    .replace(/\s*\((?:event|task|note|calendar)?\s*id:\s*[^)]+\)/gi, "")
    .replace(/\s*\bid:\s*[A-Za-z0-9_-]{16,}\b/g, "")
    .trim();
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+?\*\*|\*[^*\n]+?\*|`[^`\n]+?`)/g);
  return parts.filter(Boolean).map((p, i) => {
    const key = `${keyPrefix}-${i}`;
    if (p.startsWith("**") && p.endsWith("**"))
      return <strong key={key}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`"))
      return (
        <code
          key={key}
          className="rounded bg-foreground/10 px-1 py-0.5 font-mono text-[0.85em]"
        >
          {p.slice(1, -1)}
        </code>
      );
    if (p.startsWith("*") && p.endsWith("*"))
      return <em key={key}>{p.slice(1, -1)}</em>;
    return <React.Fragment key={key}>{p}</React.Fragment>;
  });
}

export function MessageMarkdown({ content }: { content: string }) {
  const text = clean(content);
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flush = () => {
    if (!list) return;
    const { ordered, items } = list;
    const Tag = ordered ? "ol" : "ul";
    blocks.push(
      <Tag
        key={`list-${blocks.length}`}
        className={cn(
          "space-y-1 pl-5",
          ordered ? "list-decimal" : "list-disc"
        )}
      >
        {items.map((it, i) => (
          <li key={i} className="marker:text-muted-foreground">
            {renderInline(it, `li-${blocks.length}-${i}`)}
          </li>
        ))}
      </Tag>
    );
    list = null;
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trimEnd();
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+\.\s+(.*)$/);
    if (bullet) {
      if (!list || list.ordered) {
        flush();
        list = { ordered: false, items: [] };
      }
      list.items.push(bullet[1]);
    } else if (numbered) {
      if (!list || !list.ordered) {
        flush();
        list = { ordered: true, items: [] };
      }
      list.items.push(numbered[1]);
    } else {
      flush();
      if (line.trim() !== "") {
        blocks.push(
          <p key={`p-${blocks.length}`} className="whitespace-pre-wrap">
            {renderInline(line, `p-${blocks.length}`)}
          </p>
        );
      }
    }
  });
  flush();

  return (
    <div className="space-y-2 [&_em]:italic [&_strong]:font-semibold">
      {blocks}
    </div>
  );
}

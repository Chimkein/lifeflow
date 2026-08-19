// Parser for Groq's Server-Sent Events chat stream.
//
// Network chunks do NOT align with line boundaries: a single `data: {...}` line
// (including the terminal `data: [DONE]`) can be split across two reads. The old
// parser split each chunk on "\n" with no memory between reads, so a split line
// failed JSON.parse and was dropped — and a split `[DONE]` was never seen, so the
// stream never closed and the serverless function hung to its timeout.
//
// parseSSE() is pure: give it the accumulated buffer, it returns the content
// deltas from every COMPLETE line, whether the [DONE] sentinel was seen, and the
// trailing partial line to carry into the next call.

export interface ParsedSSE {
  contents: string[];
  done: boolean;
  rest: string;
}

export function parseSSE(buffer: string): ParsedSSE {
  const contents: string[] = [];
  let done = false;

  const segments = buffer.split("\n");
  // The final segment has no trailing "\n" yet — it may be incomplete, so keep it.
  const rest = segments.pop() ?? "";

  for (const segment of segments) {
    const line = segment.replace(/\r$/, "").trim();
    if (!line || !line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (data === "[DONE]") {
      done = true;
      continue;
    }
    try {
      const json = JSON.parse(data);
      const content = json?.choices?.[0]?.delta?.content;
      if (typeof content === "string" && content.length > 0) {
        contents.push(content);
      }
    } catch {
      // Not valid JSON (shouldn't happen for a complete line) — skip defensively.
    }
  }

  return { contents, done, rest };
}

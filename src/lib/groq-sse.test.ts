import { describe, it, expect } from "vitest";
import { parseSSE } from "./groq-sse";

// Replays a Groq stream delivered as an arbitrary list of network chunks,
// carrying the partial-line buffer across reads exactly like chatStream does.
function drain(chunks: string[]): { content: string; done: boolean } {
  let buffer = "";
  let content = "";
  let done = false;
  for (const chunk of chunks) {
    buffer += chunk;
    const r = parseSSE(buffer);
    buffer = r.rest;
    content += r.contents.join("");
    if (r.done) done = true;
  }
  // Flush a final line that never got a trailing newline.
  if (buffer.trim()) {
    const r = parseSSE(buffer + "\n");
    content += r.contents.join("");
    if (r.done) done = true;
  }
  return { content, done };
}

const line = (c: string) => `data: {"choices":[{"delta":{"content":${JSON.stringify(c)}}}]}\n`;
const FULL = line("Hel") + line("lo") + "data: [DONE]\n";

describe("Groq SSE parsing", () => {
  it("parses clean, whole-line chunks", () => {
    expect(drain([line("Hel"), line("lo"), "data: [DONE]\n"])).toEqual({
      content: "Hello",
      done: true,
    });
  });

  it("recovers content when split into single characters (the prod bug)", () => {
    // Every line — including `data: [DONE]` — is split across many chunks.
    const chunks = FULL.split("");
    expect(drain(chunks)).toEqual({ content: "Hello", done: true });
  });

  it("handles a [DONE] split across two chunks so the stream still closes", () => {
    const chunks = [line("A") + "data: [DO", "NE]\n"];
    expect(drain(chunks)).toEqual({ content: "A", done: true });
  });

  it("handles a JSON line split mid-object", () => {
    const chunks = ['data: {"choices":[{"delta":{"content":"X"', '}}]}\n', "data: [DONE]\n"];
    expect(drain(chunks)).toEqual({ content: "X", done: true });
  });

  it("tolerates CRLF line endings", () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"Y"}}]}\r\n',
      "data: [DONE]\r\n",
    ];
    expect(drain(chunks)).toEqual({ content: "Y", done: true });
  });

  it("ignores reasoning-only deltas and keeps just the answer content", () => {
    const chunks = [
      'data: {"choices":[{"delta":{"reasoning":"thinking...","channel":"analysis"}}]}\n',
      line("Z"),
      "data: [DONE]\n",
    ];
    expect(drain(chunks)).toEqual({ content: "Z", done: true });
  });

  it("closes even if the stream ends without a [DONE] sentinel", () => {
    // reader.read() returning done is handled by the flush path.
    expect(drain([line("Q")])).toEqual({ content: "Q", done: false });
  });
});

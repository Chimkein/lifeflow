import { describe, it, expect } from "vitest";
import { TOOL_INSTRUCTIONS, TELEGRAM_TOOL_INSTRUCTIONS } from "./ai-prompts";

// TOOL_INSTRUCTIONS used to live inline in /api/ai/chat/route.ts. It was moved
// here so the Telegram bot could share it. This pins the web variant to the
// exact string it had before the move — the whole point was that web chat
// behaviour did NOT change. If you intend to reword the web prompt, update this
// literal deliberately.
const WEB_PROMPT_BEFORE_THE_MOVE = `

You can act on the user's data with the provided tools: create/update/complete/delete tasks, create/update/delete notes, and create/update/delete calendar events.
- When the user asks to add, change, complete, or remove something, use the matching tool.
- Reference existing items by the id shown in brackets in the context above (e.g. [id: ...] / [event id: ...]).
- To delete something, call the matching delete tool with the id. The system automatically shows the user a Confirm button and will only delete after they click it — you do NOT need to ask for confirmation in words. Just call the delete tool, then briefly tell the user which item is pending their confirmation.
- Creating, updating, and completing may be done directly. Afterwards, briefly confirm in plain language what changed. Never show raw ids to the user.`;

describe("TOOL_INSTRUCTIONS", () => {
  it("is byte-identical to the prompt web chat used before the move", () => {
    expect(TOOL_INSTRUCTIONS).toBe(WEB_PROMPT_BEFORE_THE_MOVE);
  });
});

describe("TELEGRAM_TOOL_INSTRUCTIONS", () => {
  it("does not offer delete tools", () => {
    expect(TELEGRAM_TOOL_INSTRUCTIONS).not.toContain("call the matching delete tool");
    expect(TELEGRAM_TOOL_INSTRUCTIONS).toContain("CANNOT delete");
  });

  it("does not promise a Confirm button Telegram cannot render", () => {
    expect(TELEGRAM_TOOL_INSTRUCTIONS).not.toContain("Confirm button");
  });

  it("keeps the shared tool rules in step with web", () => {
    expect(TELEGRAM_TOOL_INSTRUCTIONS).toContain(
      "When the user asks to add, change, complete, or remove something, use the matching tool."
    );
    expect(TELEGRAM_TOOL_INSTRUCTIONS).toContain("Never show raw ids to the user.");
  });

  it("forbids narrating actions it did not take", () => {
    expect(TELEGRAM_TOOL_INSTRUCTIONS).toContain("Never role-play an action");
  });
});

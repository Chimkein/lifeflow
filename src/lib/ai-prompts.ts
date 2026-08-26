// Tool-use instructions appended to the AI system prompt.
//
// Web chat and the Telegram bot must stay in step — the Telegram bot once ran
// with no tool wiring at all and happily narrated "Task Created" for tasks that
// were never written. Both variants live here, side by side, so a change to one
// is made in sight of the other. They differ in exactly one respect: deletes.
//
// Web has an inline Confirm button (see /api/ai/action), so it may call the
// delete tools. Telegram has no button flow — its webhook only reads
// `message`, never `callback_query` — so the delete tools are withheld from
// the model entirely there (DESTRUCTIVE_TOOLS is passed as `excludeTools`).

const TOOL_INTRO_WEB = `

You can act on the user's data with the provided tools: create/update/complete/delete tasks, create/update/delete notes, and create/update/delete calendar events.`;

const TOOL_INTRO_TELEGRAM = `

You can act on the user's data with the provided tools: create/update/complete tasks, create/update notes, and create/update calendar events.`;

const TOOL_COMMON = `
- When the user asks to add, change, complete, or remove something, use the matching tool.
- Reference existing items by the id shown in brackets in the context above (e.g. [id: ...] / [event id: ...]).`;

const TOOL_DELETE_WEB = `
- To delete something, call the matching delete tool with the id. The system automatically shows the user a Confirm button and will only delete after they click it — you do NOT need to ask for confirmation in words. Just call the delete tool, then briefly tell the user which item is pending their confirmation.`;

const TOOL_DELETE_TELEGRAM = `
- You CANNOT delete anything here — there are no delete tools available. If the user asks to delete a task, note, or event, tell them to remove it in the LifeFlow web app. Never claim you deleted something.`;

const TOOL_OUTRO = `
- Creating, updating, and completing may be done directly. Afterwards, briefly confirm in plain language what changed. Never show raw ids to the user.`;

const TOOL_TELEGRAM_EXTRAS = `
- Never role-play an action. Only say something was created, updated, or completed if you actually called the tool and it returned success. If you did not call a tool, do not describe a result.
- Respond using Telegram-safe HTML (<b>, <i>, <code>) only. No markdown. Keep it to a sentence or two.`;

/** Appended to the web chat system prompt. */
export const TOOL_INSTRUCTIONS =
  TOOL_INTRO_WEB + TOOL_COMMON + TOOL_DELETE_WEB + TOOL_OUTRO;

/** Appended to the Telegram bot system prompt. */
export const TELEGRAM_TOOL_INSTRUCTIONS =
  TOOL_INTRO_TELEGRAM + TOOL_COMMON + TOOL_DELETE_TELEGRAM + TOOL_OUTRO + TOOL_TELEGRAM_EXTRAS;

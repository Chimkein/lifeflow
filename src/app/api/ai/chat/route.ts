import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildUserContext, buildSystemMessage, type ChatMessage } from "@/lib/ollama";
import { chatWithTools } from "@/lib/ai-tools";
import { rateLimit } from "@/lib/rate-limit";
import { tooManyRequests } from "@/lib/api-helpers";
import { LIMITS } from "@/lib/validation";

export const maxDuration = 60;

const TOOL_INSTRUCTIONS = `

You can act on the user's data with the provided tools: create/update/complete/delete tasks, create/update/delete notes, and create/update/delete calendar events.
- When the user asks to add, change, complete, or remove something, use the matching tool.
- Reference existing items by the id shown in brackets in the context above (e.g. [id: ...] / [event id: ...]).
- To delete something, call the matching delete tool with the id. The system automatically shows the user a Confirm button and will only delete after they click it — you do NOT need to ask for confirmation in words. Just call the delete tool, then briefly tell the user which item is pending their confirmation.
- Creating, updating, and completing may be done directly. Afterwards, briefly confirm in plain language what changed. Never show raw ids to the user.`;

// Upper bound on context assembly so a slow dependency (e.g. Google Calendar)
// can never hang the whole request. If it trips, we answer without context.
const CONTEXT_TIMEOUT_MS = 20000;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;

  // Each call fans out to paid LLM providers (up to several tool rounds), so
  // cap the rate per user as defense-in-depth against runaway loops / abuse.
  const limit = rateLimit(`ai-chat:${userId}`, 20, 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  const { message, conversationId } = await req.json();
  if (!message || typeof message !== "string" || !message.trim()) {
    return new Response("Missing message", { status: 400 });
  }
  if (message.length > LIMITS.aiMessage) {
    return new Response(
      `Message too long (max ${LIMITS.aiMessage} characters)`,
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ollamaModel: true },
  });
  const model = user?.ollamaModel ?? "openai/gpt-oss-20b";

  let convId = conversationId;
  if (!convId) {
    const conv = await prisma.chatConversation.create({ data: { userId } });
    convId = conv.id;
  } else {
    const exists = await prisma.chatConversation.findFirst({
      where: { id: convId, userId },
      select: { id: true },
    });
    if (!exists) {
      return new Response("Conversation not found", { status: 404 });
    }
  }

  await prisma.chatMessage.create({
    data: { conversationId: convId, role: "user", content: message },
  });

  let userContext = "";
  try {
    userContext = await Promise.race([
      buildUserContext(userId),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error("context timeout")), CONTEXT_TIMEOUT_MS)
      ),
    ]);
  } catch (err) {
    console.error("[AI Chat] buildUserContext skipped:", err);
  }

  const history = await prisma.chatMessage.findMany({
    where: { conversationId: convId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { role: true, content: true },
  });

  const systemMsg = buildSystemMessage(userContext);
  systemMsg.content += TOOL_INSTRUCTIONS;
  const messages: ChatMessage[] = [
    systemMsg,
    ...history.reverse().map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  try {
    const { text, provider, pendingActions, actions } = await chatWithTools(userId, messages, model);
    const reply =
      text.trim() ||
      (pendingActions.length
        ? "Please confirm the action below."
        : "I couldn't generate a response. Please try again.");

    await prisma.chatMessage.create({
      data: { conversationId: convId, role: "assistant", content: reply },
    });

    const msgCount = await prisma.chatMessage.count({
      where: { conversationId: convId },
    });
    if (msgCount === 2) {
      const title = message.length > 50 ? message.slice(0, 50) + "..." : message;
      await prisma.chatConversation.update({
        where: { id: convId },
        data: { title },
      });
    }

    return Response.json({
      conversationId: convId,
      reply,
      provider,
      pendingActions,
      changed: actions.length > 0,
    });
  } catch (err) {
    console.error("[AI Chat] Error:", err);
    return Response.json(
      { error: "The assistant is temporarily unavailable. Please try again." },
      { status: 502 }
    );
  }
}

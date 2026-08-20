import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildUserContext, buildSystemMessage, type ChatMessage } from "@/lib/ollama";
import { generateReply } from "@/lib/ai";

export const maxDuration = 60;

// Upper bound on context assembly so a slow dependency (e.g. Google Calendar)
// can never hang the whole request. If it trips, we answer without context.
const CONTEXT_TIMEOUT_MS = 20000;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { message, conversationId } = await req.json();
  if (!message || typeof message !== "string") {
    return new Response("Missing message", { status: 400 });
  }

  const userId = session.user.id;

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
  const messages: ChatMessage[] = [
    systemMsg,
    ...history.reverse().map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  try {
    const { text, provider } = await generateReply(messages, model);
    const reply = text.trim() || "I couldn't generate a response. Please try again.";

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

    return Response.json({ conversationId: convId, reply, provider });
  } catch (err) {
    console.error("[AI Chat] Error:", err);
    const msg = err instanceof Error ? err.message : "AI unavailable";
    return Response.json({ error: msg }, { status: 502 });
  }
}

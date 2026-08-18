import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  buildUserContext,
  buildSystemMessage,
  chatStream,
  type ChatMessage,
} from "@/lib/ollama";

export const maxDuration = 60;

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
    const conv = await prisma.chatConversation.create({
      data: { userId },
    });
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
    userContext = await buildUserContext(userId);
  } catch (err) {
    console.error("[AI Chat] buildUserContext failed:", err);
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
    const stream = await chatStream(model, messages, req.signal);
    let fullResponse = "";

    const encoder = new TextEncoder();
    const responseStream = new ReadableStream({
      async start(controller) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ conversationId: convId })}\n\n`)
        );

        const reader = stream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fullResponse += value;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ token: value })}\n\n`)
            );
          }

          await prisma.chatMessage.create({
            data: {
              conversationId: convId,
              role: "assistant",
              content: fullResponse,
            },
          });

          const msgCount = await prisma.chatMessage.count({
            where: { conversationId: convId },
          });
          if (msgCount === 2) {
            const title =
              message.length > 50
                ? message.slice(0, 50) + "..."
                : message;
            await prisma.chatConversation.update({
              where: { id: convId },
              data: { title },
            });
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        } catch (err) {
          if (fullResponse) {
            await prisma.chatMessage.create({
              data: {
                conversationId: convId,
                role: "assistant",
                content: fullResponse,
              },
            });
          }
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: "Stream interrupted" })}\n\n`
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(responseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("[AI Chat] Error:", err);
    const msg = err instanceof Error ? err.message : "AI unavailable";
    return new Response(JSON.stringify({ error: msg }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}

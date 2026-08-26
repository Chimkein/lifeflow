import {
  sendMessage,
  setMyCommands,
  setWebhook,
  getWebhookInfo,
  isBotConfigured,
  type TelegramUpdate,
} from "@/lib/telegram";
import { generateAIBriefing, generateTaskList, generateNoteList } from "@/lib/briefing";
import { buildUserContext, buildSystemMessage, type ChatMessage } from "@/lib/ollama";
import { chatWithTools, DESTRUCTIVE_TOOLS } from "@/lib/ai-tools";
import { TELEGRAM_TOOL_INSTRUCTIONS } from "@/lib/ai-prompts";
import { rateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";
import { randomInt } from "crypto";

const DEFAULT_MODEL = "openai/gpt-oss-20b";

// Telegram conversations reuse the web app's chat tables, kept in a single
// dedicated thread per user so they don't mix into web conversations.
const TELEGRAM_CONVERSATION_TITLE = "Telegram";
const TELEGRAM_HISTORY_LIMIT = 20;

export async function generateLinkCode(userId: string): Promise<string> {
  const code = String(randomInt(100000, 999999));
  await prisma.user.update({
    where: { id: userId },
    data: {
      telegramLinkCode: code,
      telegramLinkCodeExp: new Date(Date.now() + 5 * 60 * 1000),
    },
  });
  return code;
}

export async function setupWebhook(): Promise<void> {
  if (!isBotConfigured()) {
    console.log("[Telegram] Bot token not configured, skipping webhook setup");
    return;
  }

  const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL;
  if (!baseUrl) {
    console.log("[Telegram] No base URL configured, skipping webhook setup");
    return;
  }

  const protocol = baseUrl.startsWith("http") ? "" : "https://";
  const webhookUrl = `${protocol}${baseUrl}/api/telegram/webhook`;

  // Telegram only accepts HTTPS webhooks; a localhost/http base (e.g. a stray
  // dev NEXTAUTH_URL) can never register, so don't spam the API with it.
  if (!webhookUrl.startsWith("https://")) {
    console.log(`[Telegram] Skipping webhook setup, non-HTTPS URL: ${webhookUrl}`);
    return;
  }

  // This runs on every serverless cold start. setWebhook is rate-limited, so
  // only (re)register when the target actually differs — otherwise a cold start
  // storm gets throttled and logs spurious failures.
  const info = await getWebhookInfo();
  if (info?.url === webhookUrl) {
    return;
  }

  await setMyCommands();
  const ok = await setWebhook(webhookUrl);
  if (ok) {
    console.log(`[Telegram] Webhook set to ${webhookUrl}`);
  } else {
    console.error("[Telegram] Failed to set webhook");
  }
}

export async function handleUpdate(update: TelegramUpdate): Promise<void> {
  const msg = update.message;
  if (!msg?.text) return;

  const chatId = msg.chat.id;
  const text = msg.text.trim();

  if (text.startsWith("/start")) {
    await handleStart(chatId, msg.from.first_name);
  } else if (text.startsWith("/today")) {
    await handleToday(chatId);
  } else if (text.startsWith("/tasks")) {
    await handleTasks(chatId);
  } else if (text.startsWith("/notes")) {
    await handleNotes(chatId);
  } else if (text.startsWith("/ask")) {
    await handleAsk(chatId, text.replace(/^\/ask\s*/, ""));
  } else if (/^\d{6}$/.test(text)) {
    await handleLinkCode(chatId, text, msg.from.first_name);
  }
}

async function handleStart(chatId: number, name: string): Promise<void> {
  const user = await findUserByChatId(chatId);
  if (user) {
    await sendMessage({
      chatId,
      text:
        `Hey ${name}! You're already connected to LifeFlow.\n\n` +
        "Commands:\n" +
        "/today — Today's briefing\n" +
        "/tasks — Open tasks\n" +
        "/notes — Recent notes\n" +
        "/ask — Ask AI anything",
    });
    return;
  }

  await sendMessage({
    chatId,
    text:
      `Welcome to LifeFlow, ${name}! \u{1F44B}\n\n` +
      "To connect your account, go to <b>Settings → Telegram</b> in LifeFlow " +
      "and click <b>Connect</b>. You'll get a 6-digit code — send it here.",
    parseMode: "HTML",
  });
}

async function handleLinkCode(
  chatId: number,
  code: string,
  name: string
): Promise<void> {
  const user = await prisma.user.findFirst({
    where: {
      telegramLinkCode: code,
      telegramLinkCodeExp: { gt: new Date() },
    },
    select: { id: true },
  });

  if (!user) {
    await sendMessage({
      chatId,
      text: "That code is invalid or expired. Generate a new one from LifeFlow Settings.",
    });
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      telegramChatId: String(chatId),
      telegramLinkCode: null,
      telegramLinkCodeExp: null,
    },
  });

  await sendMessage({
    chatId,
    text:
      `Connected! \u{1F389} Welcome to LifeFlow, ${name}.\n\n` +
      "You'll receive daily briefings at your configured time.\n\n" +
      "Commands:\n" +
      "/today — Today's briefing\n" +
      "/tasks — Open tasks\n" +
      "/notes — Recent notes",
  });
}

async function handleAsk(chatId: number, question: string): Promise<void> {
  if (!question) {
    await sendMessage({
      chatId,
      text: "Usage: /ask <your question>\n\nExample: /ask What should I focus on today?",
    });
    return;
  }

  const user = await findUserByChatId(chatId);
  if (!user) {
    await sendNotLinked(chatId);
    return;
  }

  // Each call fans out to paid LLM providers over several tool rounds, and can
  // now write to the user's data. Mirror the web chat's cap.
  const limit = rateLimit(`ai-chat:${user.id}`, 20, 60_000);
  if (!limit.ok) {
    await sendMessage({
      chatId,
      text: `Too many requests — give me ${limit.retryAfter}s to catch up.`,
    });
    return;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { ollamaModel: true },
  });

  await sendMessage({ chatId, text: "Thinking..." });

  try {
    const convId = await getTelegramConversation(user.id);
    await prisma.chatMessage.create({
      data: { conversationId: convId, role: "user", content: question },
    });

    const context = await buildUserContext(user.id);
    const systemMsg = buildSystemMessage(context);
    systemMsg.content += TELEGRAM_TOOL_INSTRUCTIONS;

    // Includes the message just stored above, so the model sees it as the last
    // turn — same ordering the web chat route uses.
    const history = await prisma.chatMessage.findMany({
      where: { conversationId: convId },
      orderBy: { createdAt: "desc" },
      take: TELEGRAM_HISTORY_LIMIT,
      select: { role: true, content: true },
    });

    const messages: ChatMessage[] = [
      systemMsg,
      ...history.reverse().map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    // Deletes are withheld: Telegram has no Confirm button to gate them behind.
    const { text, actions } = await chatWithTools(
      user.id,
      messages,
      dbUser?.ollamaModel ?? DEFAULT_MODEL,
      { excludeTools: DESTRUCTIVE_TOOLS }
    );

    const reply = buildAskReply(text, actions);
    await prisma.chatMessage.create({
      data: { conversationId: convId, role: "assistant", content: reply },
    });
    await sendMessage({ chatId, text: reply });
  } catch (err) {
    console.error("[Telegram] /ask failed:", err);
    await sendMessage({
      chatId,
      text: "AI is currently unavailable. Please try again later.",
    });
  }
}

// The model narrates its own actions — which is exactly how this bot used to
// announce "Task Created" for tasks it never wrote. Trust the tool results, not
// the prose: if a write failed, say so rather than let the claim stand.
function buildAskReply(
  text: string,
  actions: { name: string; ok: boolean }[]
): string {
  const body =
    text.trim() ||
    (actions.some((a) => a.ok)
      ? "Done."
      : "I couldn't generate a response.");

  const failed = [...new Set(actions.filter((a) => !a.ok).map((a) => a.name))];
  if (!failed.length) return body;

  const names = failed.map((n) => n.replace(/_/g, " ")).join(", ");
  return `${body}\n\n\u{26A0} That didn't fully work: <b>${names}</b> failed, so nothing was saved for that part.`;
}

// One reusable conversation per user, so /ask has memory across messages
// instead of starting blank every time.
async function getTelegramConversation(userId: string): Promise<string> {
  const existing = await prisma.chatConversation.findFirst({
    where: { userId, title: TELEGRAM_CONVERSATION_TITLE },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.chatConversation.create({
    data: { userId, title: TELEGRAM_CONVERSATION_TITLE },
    select: { id: true },
  });
  return created.id;
}

async function handleToday(chatId: number): Promise<void> {
  const user = await findUserByChatId(chatId);
  if (!user) {
    await sendNotLinked(chatId);
    return;
  }
  const briefing = await generateAIBriefing(user.id);
  await sendMessage({ chatId, text: briefing });
}

async function handleTasks(chatId: number): Promise<void> {
  const user = await findUserByChatId(chatId);
  if (!user) {
    await sendNotLinked(chatId);
    return;
  }
  const list = await generateTaskList(user.id);
  await sendMessage({ chatId, text: list });
}

async function handleNotes(chatId: number): Promise<void> {
  const user = await findUserByChatId(chatId);
  if (!user) {
    await sendNotLinked(chatId);
    return;
  }
  const list = await generateNoteList(user.id);
  await sendMessage({ chatId, text: list });
}

async function sendNotLinked(chatId: number): Promise<void> {
  await sendMessage({
    chatId,
    text: "Your Telegram isn't linked to a LifeFlow account yet. Send /start for instructions.",
  });
}

async function findUserByChatId(
  chatId: number
): Promise<{ id: string } | null> {
  return prisma.user.findFirst({
    where: { telegramChatId: String(chatId) },
    select: { id: true },
  });
}

export async function sendBriefingToAll(): Promise<void> {
  const users = await prisma.user.findMany({
    where: {
      telegramChatId: { not: null },
      briefingEnabled: true,
    },
    select: { id: true, telegramChatId: true },
  });

  for (const user of users) {
    if (!user.telegramChatId) continue;
    try {
      const briefing = await generateAIBriefing(user.id);
      await sendMessage({ chatId: user.telegramChatId, text: briefing });
    } catch (err) {
      console.error(`[Telegram] Failed to send briefing to user ${user.id}:`, err);
    }
  }
}

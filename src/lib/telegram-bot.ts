import {
  sendMessage,
  setMyCommands,
  setWebhook,
  isBotConfigured,
  type TelegramUpdate,
} from "@/lib/telegram";
import { generateAIBriefing, generateTaskList, generateNoteList } from "@/lib/briefing";
import { buildUserContext, buildSystemMessage, chatComplete } from "@/lib/ollama";
import { prisma } from "@/lib/db";
import { randomInt } from "crypto";

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

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { ollamaModel: true },
  });

  await sendMessage({ chatId, text: "Thinking..." });

  try {
    const context = await buildUserContext(user.id);
    const systemMsg = buildSystemMessage(context);
    const answer = await chatComplete(dbUser?.ollamaModel ?? "openai/gpt-oss-20b", [
      { ...systemMsg, content: systemMsg.content + "\n\nRespond using Telegram-safe HTML (<b>, <i>, <code>) only. No markdown. Keep it concise." },
      { role: "user", content: question },
    ]);
    await sendMessage({ chatId, text: answer || "I couldn't generate a response." });
  } catch {
    await sendMessage({
      chatId,
      text: "AI is currently unavailable. Please try again later.",
    });
  }
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

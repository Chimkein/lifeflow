const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";

function apiUrl(method: string): string {
  return `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
}

export function isBotConfigured(): boolean {
  return BOT_TOKEN.length > 0;
}

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; first_name: string; username?: string };
    chat: { id: number; type: string };
    date: number;
    text?: string;
  };
}

interface SendMessageOptions {
  chatId: string | number;
  text: string;
  parseMode?: "HTML" | "MarkdownV2";
  disableNotification?: boolean;
}

// Telegram HTML supports only a small tag set (b/strong, i/em, u/ins, s, a,
// code, pre, blockquote, tg-spoiler). Models often emit <ul>/<li>/<br>, which
// Telegram rejects — dropping ALL formatting. Convert lists to bullets and
// strip anything unsupported so the message parses as HTML.
const TG_ALLOWED = "b|strong|i|em|u|ins|s|strike|del|a|code|pre|blockquote|tg-spoiler";

export function sanitizeTelegramHtml(text: string): string {
  return text
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/?(?:ul|ol)>/gi, "")
    .replace(/<li>\s*/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(new RegExp(`<(?!/?(?:${TG_ALLOWED})(?:\\s|>|/))[^>]*>`, "gi"), "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Plain-text fallback: drop every tag and decode the basic entities so a
// non-HTML resend never shows literal markup.
export function stripTelegramHtml(text: string): string {
  return text
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/?(?:ul|ol)>/gi, "")
    .replace(/<li>\s*/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function sendMessage({
  chatId,
  text,
  parseMode = "HTML",
  disableNotification = false,
}: SendMessageOptions): Promise<boolean> {
  const outgoing = parseMode === "HTML" ? sanitizeTelegramHtml(text) : text;
  try {
    const res = await fetch(apiUrl("sendMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: outgoing,
        parse_mode: parseMode,
        disable_notification: disableNotification,
      }),
    });
    const data = await res.json();
    if (data.ok === true) return true;

    if (parseMode) {
      console.warn(
        "[Telegram] sendMessage failed with parse_mode, retrying as plain text:",
        data,
      );
      const retryRes = await fetch(apiUrl("sendMessage"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: stripTelegramHtml(text),
          disable_notification: disableNotification,
        }),
      });
      const retryData = await retryRes.json();
      return retryData.ok === true;
    }

    return false;
  } catch (err) {
    console.error("[Telegram] sendMessage error:", err);
    return false;
  }
}

export async function setWebhook(url: string): Promise<boolean> {
  try {
    const res = await fetch(apiUrl("setWebhook"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        allowed_updates: ["message"],
        secret_token: process.env.TELEGRAM_WEBHOOK_SECRET ?? "",
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      // Surface Telegram's actual reason (e.g. rate limit, bad URL) instead of
      // a bare "failed".
      console.error("[Telegram] setWebhook rejected:", data.description ?? data);
    }
    return data.ok === true;
  } catch (err) {
    console.error("[Telegram] setWebhook error:", err);
    return false;
  }
}

export async function getWebhookInfo(): Promise<{ url?: string } | null> {
  try {
    const res = await fetch(apiUrl("getWebhookInfo"));
    const data = await res.json();
    return data.ok ? data.result : null;
  } catch (err) {
    console.error("[Telegram] getWebhookInfo error:", err);
    return null;
  }
}

export async function deleteWebhook(): Promise<boolean> {
  try {
    const res = await fetch(apiUrl("deleteWebhook"));
    const data = await res.json();
    return data.ok === true;
  } catch {
    return false;
  }
}

export async function setMyCommands(): Promise<void> {
  try {
    await fetch(apiUrl("setMyCommands"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commands: [
          { command: "start", description: "Connect to LifeFlow" },
          { command: "today", description: "Today's briefing" },
          { command: "tasks", description: "Open tasks" },
          { command: "notes", description: "Recent notes" },
          { command: "ask", description: "Ask AI anything" },
        ],
      }),
    });
  } catch (err) {
    console.error("[Telegram] setMyCommands error:", err);
  }
}

export async function getMe(): Promise<{ username: string } | null> {
  try {
    const res = await fetch(apiUrl("getMe"));
    const data = await res.json();
    return data.ok ? data.result : null;
  } catch {
    return null;
  }
}

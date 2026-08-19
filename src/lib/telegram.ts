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

export async function sendMessage({
  chatId,
  text,
  parseMode = "HTML",
  disableNotification = false,
}: SendMessageOptions): Promise<boolean> {
  try {
    const res = await fetch(apiUrl("sendMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
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
          text,
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

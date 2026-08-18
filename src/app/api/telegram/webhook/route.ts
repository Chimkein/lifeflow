import { NextResponse } from "next/server";
import { handleUpdate } from "@/lib/telegram-bot";
import { isBotConfigured, type TelegramUpdate } from "@/lib/telegram";

export async function POST(req: Request) {
  if (!isBotConfigured()) {
    return NextResponse.json({ error: "Bot not configured" }, { status: 503 });
  }

  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  // Process in background — respond to Telegram immediately to avoid timeout
  void handleUpdate(update).catch((err) => {
    console.error("[Telegram Webhook] Error:", err);
  });

  return NextResponse.json({ ok: true });
}

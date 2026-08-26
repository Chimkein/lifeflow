import { NextResponse, after } from "next/server";
import { handleUpdate } from "@/lib/telegram-bot";
import { isBotConfigured, type TelegramUpdate } from "@/lib/telegram";

export const maxDuration = 60;

export async function POST(req: Request) {
  if (!isBotConfigured()) {
    return NextResponse.json({ error: "Bot not configured" }, { status: 503 });
  }

  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch (err) {
    console.error("[Telegram Webhook] Malformed payload:", err);
    return NextResponse.json({ ok: true });
  }

  // Acknowledge Telegram immediately, then do the work. An /ask can run several
  // AI tool rounds and outlast Telegram's patience; Telegram would retry the
  // update, replay the message, and create the same task twice. `after` runs
  // within this route's maxDuration, after the response is sent.
  after(async () => {
    try {
      await handleUpdate(update);
    } catch (err) {
      console.error("[Telegram Webhook] Error:", err);
    }
  });

  return NextResponse.json({ ok: true });
}

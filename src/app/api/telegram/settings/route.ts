import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isBotConfigured, getMe } from "@/lib/telegram";
import { isValidHm } from "@/lib/validation";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      telegramChatId: true,
      briefingTime: true,
      briefingEnabled: true,
    },
  });

  const botConfigured = isBotConfigured();
  let botUsername: string | null = null;
  if (botConfigured) {
    const me = await getMe();
    botUsername = me?.username ?? null;
  }

  return NextResponse.json({
    connected: !!user?.telegramChatId,
    chatId: user?.telegramChatId ?? null,
    briefingTime: user?.briefingTime ?? "07:00",
    briefingEnabled: user?.briefingEnabled ?? true,
    botConfigured,
    botUsername,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { briefingTime, briefingEnabled, disconnect } = body as {
    briefingTime?: string;
    briefingEnabled?: boolean;
    disconnect?: boolean;
  };

  const data: Record<string, unknown> = {};
  if (briefingTime !== undefined) {
    // Must be a 24h "HH:mm" string — the cron briefing does a lexical compare
    // against it, so a malformed value would silently break scheduling.
    if (!isValidHm(briefingTime)) {
      return NextResponse.json(
        { error: "briefingTime must be in HH:mm format (e.g. 07:00)" },
        { status: 400 }
      );
    }
    data.briefingTime = briefingTime;
  }
  if (briefingEnabled !== undefined) {
    if (typeof briefingEnabled !== "boolean") {
      return NextResponse.json(
        { error: "briefingEnabled must be a boolean" },
        { status: 400 }
      );
    }
    data.briefingEnabled = briefingEnabled;
  }
  if (disconnect) data.telegramChatId = null;

  await prisma.user.update({
    where: { id: session.user.id },
    data,
  });

  return NextResponse.json({ ok: true });
}

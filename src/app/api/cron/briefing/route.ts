import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateAIBriefing } from "@/lib/briefing";
import { sendMessage } from "@/lib/telegram";
import { userNow } from "@/lib/timezone";

export const maxDuration = 60;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = userNow();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const users = await prisma.user.findMany({
    where: {
      telegramChatId: { not: null },
      briefingEnabled: true,
      briefingTime: currentTime,
    },
    select: { id: true, telegramChatId: true },
  });

  let sent = 0;
  for (const user of users) {
    if (!user.telegramChatId) continue;
    try {
      const briefing = await generateAIBriefing(user.id);
      await sendMessage({ chatId: user.telegramChatId, text: briefing });
      sent++;
    } catch (err) {
      console.error(`[Briefing] Failed for user ${user.id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, checked: users.length, sent });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateAIBriefing } from "@/lib/briefing";
import { sendMessage } from "@/lib/telegram";
import { startOfZonedDay, zonedHm } from "@/lib/timezone";

export const maxDuration = 60;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const currentTime = zonedHm(now); // "HH:mm" in the user's timezone
  const todayStart = startOfZonedDay(now); // UTC instant of local midnight today

  // Candidates: briefing on, linked to Telegram, and not already sent today.
  // This tolerates a coarse/irregular scheduler (e.g. every 15 min) instead of
  // requiring an exact per-minute trigger.
  const users = await prisma.user.findMany({
    where: {
      telegramChatId: { not: null },
      briefingEnabled: true,
      OR: [{ lastBriefingSentAt: null }, { lastBriefingSentAt: { lt: todayStart } }],
    },
    select: { id: true, telegramChatId: true, briefingTime: true },
  });

  let sent = 0;
  for (const user of users) {
    if (!user.telegramChatId) continue;
    // Only once their chosen time has arrived today (zero-padded HH:mm compares lexically).
    if ((user.briefingTime ?? "07:00") > currentTime) continue;
    try {
      const briefing = await generateAIBriefing(user.id);
      await sendMessage({ chatId: user.telegramChatId, text: briefing });
      await prisma.user.update({
        where: { id: user.id },
        data: { lastBriefingSentAt: new Date() },
      });
      sent++;
    } catch (err) {
      console.error(`[Briefing] Failed for user ${user.id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, candidates: users.length, sent });
}

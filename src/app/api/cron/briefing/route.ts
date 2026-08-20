import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateAIBriefing } from "@/lib/briefing";
import { sendMessage } from "@/lib/telegram";
import { zonedYmd, zonedHm, DEFAULT_TIMEZONE } from "@/lib/timezone";

export const maxDuration = 60;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Candidates: briefing on and linked to Telegram. The "already sent today"
  // and "chosen time reached" checks run per-user below using each user's OWN
  // timezone, so someone in GMT gets their 07:00 briefing at 07:00 GMT — not
  // 07:00 server time. Tolerates a coarse scheduler (e.g. every 15 min).
  const users = await prisma.user.findMany({
    where: {
      telegramChatId: { not: null },
      briefingEnabled: true,
    },
    select: {
      id: true,
      telegramChatId: true,
      briefingTime: true,
      timezone: true,
      lastBriefingSentAt: true,
    },
  });

  let sent = 0;
  for (const user of users) {
    if (!user.telegramChatId) continue;
    const tz = user.timezone ?? DEFAULT_TIMEZONE;
    const currentTime = zonedHm(now, tz); // "HH:mm" in the user's timezone
    // Only once their chosen time has arrived today (zero-padded HH:mm compares lexically).
    if ((user.briefingTime ?? "07:00") > currentTime) continue;
    // Airtight "once per local day": compare the last-sent instant and now as
    // local dates in the SAME current timezone. Because both sides use the same
    // zone, changing timezones can neither double-send nor skip a day (the old
    // startOfZonedDay-boundary check could, since that boundary moved with tz).
    if (
      user.lastBriefingSentAt &&
      zonedYmd(user.lastBriefingSentAt, tz) === zonedYmd(now, tz)
    ) {
      continue;
    }
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

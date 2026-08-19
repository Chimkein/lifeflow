import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncGmailAppointments } from "@/lib/gmail-appointments";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    where: { gmailSyncEnabled: true },
    select: { id: true },
  });

  let totalDetected = 0;
  for (const user of users) {
    try {
      const count = await syncGmailAppointments(user.id);
      totalDetected += count;
      if (count > 0) {
        console.log(`[Gmail] Detected ${count} appointment(s) for user ${user.id}`);
      }
    } catch (err) {
      console.error(`[Gmail] Sync failed for user ${user.id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, users: users.length, detected: totalDetected });
}

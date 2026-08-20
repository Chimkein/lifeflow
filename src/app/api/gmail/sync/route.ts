import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncGmailAppointments } from "@/lib/gmail-appointments";
import { rateLimit } from "@/lib/rate-limit";
import { tooManyRequests } from "@/lib/api-helpers";

export const maxDuration = 60;

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // A full Gmail scan + AI extraction is expensive; allow only a few per minute.
  const limit = rateLimit(`gmail-sync:${session.user.id}`, 5, 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  try {
    const count = await syncGmailAppointments(session.user.id);
    return NextResponse.json({ ok: true, detected: count });
  } catch (err) {
    console.error("[Gmail Sync] Error:", err);
    return NextResponse.json(
      { error: "Sync failed" },
      { status: 500 }
    );
  }
}

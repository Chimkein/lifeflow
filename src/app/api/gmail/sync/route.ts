import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncGmailAppointments } from "@/lib/gmail-appointments";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

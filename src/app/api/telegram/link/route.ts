import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateLinkCode } from "@/lib/telegram-bot";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const code = await generateLinkCode(session.user.id);
  return NextResponse.json({ code });
}

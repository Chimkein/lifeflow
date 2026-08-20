import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isValidTimeZone, DEFAULT_TIMEZONE } from "@/lib/timezone";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { timezone: true },
  });

  return NextResponse.json({ timezone: user?.timezone ?? DEFAULT_TIMEZONE });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  if (!isValidTimeZone(body.timezone)) {
    return NextResponse.json(
      { error: "Invalid timezone" },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { timezone: body.timezone },
  });

  return NextResponse.json({ ok: true, timezone: body.timezone });
}

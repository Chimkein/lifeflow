import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasGmailScope } from "@/lib/google-auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { gmailSyncEnabled: true, gmailLastSyncAt: true },
  });

  const hasScope = await hasGmailScope(session.user.id);

  return NextResponse.json({
    gmailSyncEnabled: user?.gmailSyncEnabled ?? false,
    gmailLastSyncAt: user?.gmailLastSyncAt?.toISOString() ?? null,
    hasGmailScope: hasScope,
  });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (typeof body.gmailSyncEnabled === "boolean") {
    data.gmailSyncEnabled = body.gmailSyncEnabled;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data,
  });

  return NextResponse.json({ ok: true });
}

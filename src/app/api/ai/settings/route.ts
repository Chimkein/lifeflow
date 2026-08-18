import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { ollamaModel: true, aiBriefingEnabled: true },
  });

  return NextResponse.json({
    ollamaModel: user?.ollamaModel ?? "llama3.1:8b",
    aiBriefingEnabled: user?.aiBriefingEnabled ?? false,
  });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (typeof body.ollamaModel === "string") {
    data.ollamaModel = body.ollamaModel;
  }
  if (typeof body.aiBriefingEnabled === "boolean") {
    data.aiBriefingEnabled = body.aiBriefingEnabled;
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

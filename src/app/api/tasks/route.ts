import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");

  const tasks = await prisma.task.findMany({
    where: {
      userId: session.user.id,
      ...(status && { status }),
      ...(priority && { priority }),
    },
    include: {
      taskNotes: { include: { note: { select: { id: true, title: true } } } },
    },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { title, description, priority, dueAt } = body as {
    title: string;
    description?: string;
    priority?: string;
    dueAt?: string;
  };

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const task = await prisma.task.create({
    data: {
      userId: session.user.id,
      title: title.trim(),
      description: description || null,
      priority: priority || "medium",
      dueAt: dueAt ? new Date(dueAt) : null,
    },
  });

  return NextResponse.json({ task }, { status: 201 });
}

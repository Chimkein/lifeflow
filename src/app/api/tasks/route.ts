import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validationError } from "@/lib/api-helpers";
import {
  reqString,
  optString,
  optEnum,
  optDate,
  LIMITS,
  TASK_PRIORITIES,
} from "@/lib/validation";

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

  const body = await req.json().catch(() => ({}));

  let title: string;
  let description: string | undefined;
  let priority: string | undefined;
  let dueAt: Date | null;
  try {
    title = reqString(body.title, "Title", LIMITS.taskTitle);
    description = optString(body.description, "Description", LIMITS.taskDescription);
    priority = optEnum(body.priority, "Priority", TASK_PRIORITIES);
    dueAt = optDate(body.dueAt, "Due date") ?? null;
  } catch (e) {
    return validationError(e) ?? NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const task = await prisma.task.create({
    data: {
      userId: session.user.id,
      title,
      description: description || null,
      priority: priority || "medium",
      dueAt,
    },
  });

  return NextResponse.json({ task }, { status: 201 });
}

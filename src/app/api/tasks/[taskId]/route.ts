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
  TASK_STATUSES,
} from "@/lib/validation";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId } = await params;

  const task = await prisma.task.findFirst({
    where: { id: taskId, userId: session.user.id },
    include: {
      taskNotes: { include: { note: { select: { id: true, title: true } } } },
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ task });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId } = await params;
  const body = await req.json().catch(() => ({}));

  let title: string | undefined;
  let description: string | undefined;
  let status: string | undefined;
  let priority: string | undefined;
  let dueAt: Date | null | undefined;
  try {
    title =
      body.title === undefined
        ? undefined
        : reqString(body.title, "Title", LIMITS.taskTitle);
    description = optString(body.description, "Description", LIMITS.taskDescription);
    status = optEnum(body.status, "Status", TASK_STATUSES);
    priority = optEnum(body.priority, "Priority", TASK_PRIORITIES);
    dueAt = optDate(body.dueAt, "Due date");
  } catch (e) {
    return validationError(e) ?? NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const existing = await prisma.task.findFirst({
    where: { id: taskId, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description: description || null }),
      ...(priority !== undefined && { priority }),
      ...(dueAt !== undefined && { dueAt }),
      ...(status !== undefined && {
        status,
        completedAt: status === "completed" ? new Date() : null,
      }),
    },
  });

  return NextResponse.json({ task });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId } = await params;

  const existing = await prisma.task.findFirst({
    where: { id: taskId, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.task.delete({ where: { id: taskId } });

  return new NextResponse(null, { status: 204 });
}

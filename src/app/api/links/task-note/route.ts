import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId, noteId } = (await req.json()) as {
    taskId: string;
    noteId: string;
  };

  if (!taskId || !noteId) {
    return NextResponse.json(
      { error: "taskId and noteId are required" },
      { status: 400 }
    );
  }

  const [task, note] = await Promise.all([
    prisma.task.findFirst({ where: { id: taskId, userId: session.user.id } }),
    prisma.note.findFirst({ where: { id: noteId, userId: session.user.id } }),
  ]);

  if (!task || !note) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const link = await prisma.taskNote.upsert({
    where: { taskId_noteId: { taskId, noteId } },
    create: { taskId, noteId },
    update: {},
  });

  return NextResponse.json({ link }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId, noteId } = (await req.json()) as {
    taskId: string;
    noteId: string;
  };

  if (!taskId || !noteId) {
    return NextResponse.json(
      { error: "taskId and noteId are required" },
      { status: 400 }
    );
  }

  const [task, note] = await Promise.all([
    prisma.task.findFirst({ where: { id: taskId, userId: session.user.id } }),
    prisma.note.findFirst({ where: { id: noteId, userId: session.user.id } }),
  ]);

  if (!task || !note) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.taskNote.deleteMany({ where: { taskId, noteId } });

  return new NextResponse(null, { status: 204 });
}

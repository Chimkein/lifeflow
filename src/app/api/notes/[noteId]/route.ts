import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validationError } from "@/lib/api-helpers";
import { reqString, optString, optTags, LIMITS } from "@/lib/validation";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { noteId } = await params;

  const note = await prisma.note.findFirst({
    where: { id: noteId, userId: session.user.id },
    include: {
      tags: true,
      taskNotes: { include: { task: { select: { id: true, title: true, status: true, priority: true } } } },
    },
  });

  if (!note) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ note });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { noteId } = await params;
  const body = await req.json().catch(() => ({}));

  let title: string | undefined;
  let content: string | undefined;
  let tags: string[] | undefined;
  const archived = typeof body.archived === "boolean" ? body.archived : undefined;
  try {
    title =
      body.title === undefined
        ? undefined
        : reqString(body.title, "Title", LIMITS.noteTitle);
    content = optString(body.content, "Content", LIMITS.noteContent, { trim: false });
    tags = optTags(body.tags);
  } catch (e) {
    return validationError(e) ?? NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const existing = await prisma.note.findFirst({
    where: { id: noteId, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const note = await prisma.note.update({
    where: { id: noteId },
    data: {
      ...(title !== undefined && { title }),
      ...(content !== undefined && { content }),
      ...(archived !== undefined && {
        archivedAt: archived ? new Date() : null,
      }),
      ...(tags !== undefined && {
        tags: {
          deleteMany: {},
          create: tags.map((t) => ({ tag: t })),
        },
      }),
    },
    include: { tags: true },
  });

  return NextResponse.json({ note });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { noteId } = await params;

  const existing = await prisma.note.findFirst({
    where: { id: noteId, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.note.delete({ where: { id: noteId } });

  return new NextResponse(null, { status: 204 });
}

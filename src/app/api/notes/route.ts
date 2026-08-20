import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validationError } from "@/lib/api-helpers";
import { reqString, optString, optTags, LIMITS } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search") ?? "";
  const tag = searchParams.get("tag");
  const archived = searchParams.get("archived") === "true";

  const notes = await prisma.note.findMany({
    where: {
      userId: session.user.id,
      archivedAt: archived ? { not: null } : null,
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { content: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(tag && { tags: { some: { tag } } }),
    },
    include: {
      tags: true,
      taskNotes: { include: { task: { select: { id: true, title: true, status: true, priority: true } } } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ notes });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  let title: string;
  let content: string | undefined;
  let tags: string[] | undefined;
  try {
    title = reqString(body.title, "Title", LIMITS.noteTitle);
    content = optString(body.content, "Content", LIMITS.noteContent, { trim: false });
    tags = optTags(body.tags);
  } catch (e) {
    return validationError(e) ?? NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const note = await prisma.note.create({
    data: {
      userId: session.user.id,
      title,
      content: content ?? "",
      tags: tags?.length
        ? { create: tags.map((t) => ({ tag: t })) }
        : undefined,
    },
    include: { tags: true },
  });

  return NextResponse.json({ note }, { status: 201 });
}

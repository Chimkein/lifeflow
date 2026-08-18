import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateEvent, deleteEvent } from "@/lib/google-calendar";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { eventId } = await params;

  try {
    const body = await req.json();
    const event = await updateEvent(session.user.id, eventId, body);
    return NextResponse.json({ event });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "NO_GOOGLE_ACCOUNT" || message === "REAUTH_REQUIRED") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { eventId } = await params;

  try {
    await deleteEvent(session.user.id, eventId);
    return new NextResponse(null, { status: 204 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "NO_GOOGLE_ACCOUNT" || message === "REAUTH_REQUIRED") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

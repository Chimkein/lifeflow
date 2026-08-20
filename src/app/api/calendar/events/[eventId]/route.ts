import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  updateEvent,
  deleteEvent,
  type CalendarEventInput,
} from "@/lib/google-calendar";
import { validationError } from "@/lib/api-helpers";
import { parseCalendarEvent } from "@/lib/validation";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { eventId } = await params;

  let input: CalendarEventInput;
  try {
    const body = await req.json().catch(() => ({}));
    input = parseCalendarEvent(body, { partial: true }) as CalendarEventInput;
  } catch (e) {
    return validationError(e) ?? NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    const event = await updateEvent(session.user.id, eventId, input);
    return NextResponse.json({ event });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "NO_GOOGLE_ACCOUNT" || message === "REAUTH_REQUIRED") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    console.error("[Calendar] update error:", e);
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
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
    console.error("[Calendar] delete error:", e);
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  listEvents,
  createEvent,
  type CalendarEventInput,
} from "@/lib/google-calendar";
import { validationError } from "@/lib/api-helpers";
import { parseCalendarEvent } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const timeMin = searchParams.get("timeMin");
  const timeMax = searchParams.get("timeMax");

  if (!timeMin || !timeMax) {
    return NextResponse.json(
      { error: "timeMin and timeMax are required" },
      { status: 400 }
    );
  }

  try {
    const events = await listEvents(session.user.id, timeMin, timeMax);
    return NextResponse.json({ events });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "NO_GOOGLE_ACCOUNT" || message === "REAUTH_REQUIRED") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    console.error("[Calendar] list error:", e);
    return NextResponse.json({ error: "Failed to load events" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let input: CalendarEventInput;
  try {
    const body = await req.json().catch(() => ({}));
    input = parseCalendarEvent(body) as CalendarEventInput;
  } catch (e) {
    return validationError(e) ?? NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    const event = await createEvent(session.user.id, input);
    return NextResponse.json({ event }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "NO_GOOGLE_ACCOUNT" || message === "REAUTH_REQUIRED") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    console.error("[Calendar] create error:", e);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}

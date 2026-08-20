import { getValidAccessToken } from "@/lib/google-auth";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  status?: string;
  htmlLink?: string;
  colorId?: string;
}

interface GoogleCalendarListResponse {
  items: GoogleCalendarEvent[];
  nextPageToken?: string;
}

export interface CalendarEventInput {
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
}

async function calendarFetch(
  userId: string,
  path: string,
  options: RequestInit = {}
) {
  const token = await getValidAccessToken(userId);
  const res = await fetch(`${CALENDAR_API}${path}`, {
    ...options,
    // Never let a stalled Google call hang a request (e.g. the AI chat's
    // buildUserContext) to its serverless timeout.
    signal: options.signal ?? AbortSignal.timeout(15000),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Calendar API error ${res.status}: ${error}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function listEvents(
  userId: string,
  timeMin: string,
  timeMax: string
): Promise<GoogleCalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });

  const data: GoogleCalendarListResponse = await calendarFetch(
    userId,
    `/calendars/primary/events?${params}`
  );

  return data.items || [];
}

export async function createEvent(
  userId: string,
  event: CalendarEventInput
): Promise<GoogleCalendarEvent> {
  return calendarFetch(userId, "/calendars/primary/events", {
    method: "POST",
    body: JSON.stringify(event),
  });
}

export async function updateEvent(
  userId: string,
  eventId: string,
  event: CalendarEventInput
): Promise<GoogleCalendarEvent> {
  return calendarFetch(
    userId,
    `/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(event),
    }
  );
}

export async function deleteEvent(
  userId: string,
  eventId: string
): Promise<void> {
  await calendarFetch(
    userId,
    `/calendars/primary/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE" }
  );
}

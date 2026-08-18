import { prisma } from "@/lib/db";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

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

async function getValidAccessToken(userId: string): Promise<string> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  });

  if (!account) {
    throw new Error("NO_GOOGLE_ACCOUNT");
  }

  const now = Math.floor(Date.now() / 1000);
  if (account.expires_at && account.expires_at > now + 60) {
    return account.access_token!;
  }

  if (!account.refresh_token) {
    throw new Error("NO_REFRESH_TOKEN");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: account.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    if (error.error === "invalid_grant") {
      throw new Error("REAUTH_REQUIRED");
    }
    throw new Error(`Token refresh failed: ${res.status}`);
  }

  const tokens: GoogleTokenResponse = await res.json();

  await prisma.account.update({
    where: {
      provider_providerAccountId: {
        provider: account.provider,
        providerAccountId: account.providerAccountId,
      },
    },
    data: {
      access_token: tokens.access_token,
      expires_at: now + tokens.expires_in,
    },
  });

  return tokens.access_token;
}

async function calendarFetch(
  userId: string,
  path: string,
  options: RequestInit = {}
) {
  const token = await getValidAccessToken(userId);
  const res = await fetch(`${CALENDAR_API}${path}`, {
    ...options,
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

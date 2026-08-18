import { getValidAccessToken } from "@/lib/google-auth";

const GMAIL_API = "https://www.googleapis.com/gmail/v1";

export interface GmailEmail {
  messageId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

interface GmailMessageListResponse {
  messages?: { id: string; threadId: string }[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

interface GmailMessageResponse {
  id: string;
  snippet: string;
  payload: {
    headers: { name: string; value: string }[];
  };
}

async function gmailFetch(
  userId: string,
  path: string,
  options: RequestInit = {}
) {
  const token = await getValidAccessToken(userId);
  const res = await fetch(`${GMAIL_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Gmail API error ${res.status}: ${error}`);
  }

  return res.json();
}

async function listRecentMessages(
  userId: string,
  daysBack = 7
): Promise<{ id: string }[]> {
  const params = new URLSearchParams({
    q: `newer_than:${daysBack}d`,
    labelIds: "INBOX",
    maxResults: "50",
  });

  const data: GmailMessageListResponse = await gmailFetch(
    userId,
    `/users/me/messages?${params}`
  );

  return data.messages ?? [];
}

async function getMessageDetails(
  userId: string,
  messageId: string
): Promise<GmailEmail> {
  const params = new URLSearchParams({
    format: "metadata",
    metadataHeaders: "Subject",
  });
  // Gmail API only accepts one metadataHeaders per param
  params.append("metadataHeaders", "From");
  params.append("metadataHeaders", "Date");

  const data: GmailMessageResponse = await gmailFetch(
    userId,
    `/users/me/messages/${messageId}?${params}`
  );

  const headers = data.payload.headers;
  const getHeader = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ??
    "";

  return {
    messageId: data.id,
    subject: getHeader("Subject"),
    from: getHeader("From"),
    date: getHeader("Date"),
    snippet: data.snippet,
  };
}

export async function fetchRecentEmails(
  userId: string,
  daysBack = 7
): Promise<GmailEmail[]> {
  const messageRefs = await listRecentMessages(userId, daysBack);

  if (messageRefs.length === 0) return [];

  const emails = await Promise.all(
    messageRefs.map((ref) => getMessageDetails(userId, ref.id))
  );

  return emails;
}

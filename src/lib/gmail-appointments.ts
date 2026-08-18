import { prisma } from "@/lib/db";
import { fetchRecentEmails, type GmailEmail } from "@/lib/google-gmail";
import { chatComplete, isOllamaAvailable } from "@/lib/ollama";
import { format } from "date-fns";
import { userNow } from "@/lib/timezone";

interface DetectedAppointment {
  emailIndex: number;
  title: string;
  date: string;
  time: string | null;
  location: string | null;
  description: string | null;
}

const DETECTION_PROMPT = `You are an appointment detector. Given a list of emails (subject + snippet), identify ONLY emails that clearly contain an appointment, meeting, reservation, booking, or scheduled event.

For each detected appointment, extract:
- emailIndex: the index of the email in the list (0-based)
- title: short name for the appointment
- date: the appointment date in YYYY-MM-DD format
- time: the time in HH:MM format (24h), or null if not specified
- location: the location/venue, or null if not specified
- description: brief description, or null

Respond with ONLY a JSON array. If no appointments are found, respond with [].
Do NOT include promotional emails, newsletters, shipping notifications, or general reminders that aren't scheduled events.

Example response:
[{"emailIndex": 2, "title": "Dentist Appointment", "date": "2026-08-20", "time": "14:30", "location": "SmileCare Clinic", "description": "Regular checkup"}]`;

async function detectAppointments(
  emails: GmailEmail[],
  model: string
): Promise<DetectedAppointment[]> {
  if (emails.length === 0) return [];

  const emailList = emails
    .map(
      (e, i) =>
        `[${i}] Subject: ${e.subject}\nFrom: ${e.from}\nDate: ${e.date}\nSnippet: ${e.snippet}`
    )
    .join("\n\n");

  const today = format(userNow(), "yyyy-MM-dd");

  const response = await chatComplete(model, [
    { role: "system", content: DETECTION_PROMPT },
    {
      role: "user",
      content: `Today's date is ${today}. Analyze these emails:\n\n${emailList}`,
    },
  ]);

  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const parsed: DetectedAppointment[] = JSON.parse(jsonMatch[0]);
    return parsed.filter(
      (a) =>
        a.emailIndex >= 0 &&
        a.emailIndex < emails.length &&
        a.title &&
        a.date &&
        /^\d{4}-\d{2}-\d{2}$/.test(a.date)
    );
  } catch {
    console.error("[Gmail] Failed to parse AI appointment detection response");
    return [];
  }
}

export async function syncGmailAppointments(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { gmailSyncEnabled: true, ollamaModel: true },
  });

  if (!user?.gmailSyncEnabled) return 0;

  const available = await isOllamaAvailable();
  if (!available) {
    console.warn("[Gmail] Ollama unavailable, skipping appointment detection");
    return 0;
  }

  let emails: GmailEmail[];
  try {
    emails = await fetchRecentEmails(userId);
  } catch (err) {
    console.error("[Gmail] Failed to fetch emails:", err);
    return 0;
  }

  if (emails.length === 0) {
    await prisma.user.update({
      where: { id: userId },
      data: { gmailLastSyncAt: new Date() },
    });
    return 0;
  }

  const existingIds = await prisma.gmailAppointment.findMany({
    where: {
      userId,
      gmailMessageId: { in: emails.map((e) => e.messageId) },
    },
    select: { gmailMessageId: true },
  });
  const existingSet = new Set(existingIds.map((e: { gmailMessageId: string }) => e.gmailMessageId));

  const newEmails = emails.filter((e) => !existingSet.has(e.messageId));
  if (newEmails.length === 0) {
    await prisma.user.update({
      where: { id: userId },
      data: { gmailLastSyncAt: new Date() },
    });
    return 0;
  }

  const detected = await detectAppointments(newEmails, user.ollamaModel);

  if (detected.length > 0) {
    await prisma.gmailAppointment.createMany({
      data: detected.map((apt) => {
        const email = newEmails[apt.emailIndex];
        return {
          userId,
          gmailMessageId: email.messageId,
          title: apt.title,
          description: apt.description,
          location: apt.location,
          appointmentDate: new Date(apt.date),
          appointmentTime: apt.time,
          status: "pending",
          sourceSubject: email.subject,
          sourceSnippet: email.snippet,
        };
      }),
      skipDuplicates: true,
    });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { gmailLastSyncAt: new Date() },
  });

  return detected.length;
}

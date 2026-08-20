import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { startOfZonedDay, endOfZonedDay, DEFAULT_TIMEZONE } from "@/lib/timezone";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");

  const userRow = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { timezone: true },
  });
  const tz = userRow?.timezone ?? DEFAULT_TIMEZONE;

  const targetDate = dateParam ? new Date(dateParam) : new Date();
  const dayStart = startOfZonedDay(targetDate, tz);
  const dayEnd = endOfZonedDay(targetDate, tz);

  const appointments = await prisma.gmailAppointment.findMany({
    where: {
      userId: session.user.id,
      appointmentDate: { gte: dayStart, lte: dayEnd },
      status: { not: "dismissed" },
    },
    orderBy: { appointmentTime: "asc" },
  });

  return NextResponse.json(appointments);
}

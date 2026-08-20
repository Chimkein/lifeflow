import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ appointmentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { appointmentId } = await params;
  const body = await req.json();
  const { status } = body as { status?: string };

  if (!status || !["confirmed", "dismissed"].includes(status)) {
    return NextResponse.json(
      { error: "Status must be 'confirmed' or 'dismissed'" },
      { status: 400 }
    );
  }

  // Scope the write to the owner in a single query — no cross-tenant fetch,
  // and a mismatched user simply updates zero rows.
  const result = await prisma.gmailAppointment.updateMany({
    where: { id: appointmentId, userId: session.user.id },
    data: { status },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.gmailAppointment.findUnique({
    where: { id: appointmentId },
  });

  return NextResponse.json(updated);
}

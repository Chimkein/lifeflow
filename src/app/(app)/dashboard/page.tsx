import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  CheckSquare,
  StickyNote,
  Clock,
  Mail,
  MapPin,
} from "lucide-react";
import { startOfDay, endOfDay, addDays, format } from "date-fns";
import { userNow } from "@/lib/timezone";
import Link from "next/link";
import { AppointmentActions } from "@/components/dashboard/appointment-actions";

function getGreeting() {
  const hour = userNow().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const session = await auth();
  const firstName = session?.user?.name?.split(" ")[0] ?? "there";
  const userId = session?.user?.id;

  let openTasks = 0;
  let noteCount = 0;
  let upcomingCount = 0;
  let todayTasks: { id: string; title: string; priority: string; dueAt: Date | null }[] = [];
  let recentNotes: { id: string; title: string; updatedAt: Date; tags: { id: string; tag: string }[] }[] = [];
  let appointments: { id: string; title: string; appointmentTime: string | null; location: string | null; status: string; sourceSubject: string }[] = [];

  if (userId) {
    const now = userNow();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const weekEnd = endOfDay(addDays(now, 7));

    const [tasks, notes, upcoming, recent, gmailAppts] = await Promise.all([
      prisma.task.count({
        where: { userId, status: { not: "completed" } },
      }),
      prisma.note.count({
        where: { userId, archivedAt: null },
      }),
      prisma.task.findMany({
        where: {
          userId,
          status: { not: "completed" },
          dueAt: { gte: todayStart, lte: weekEnd },
        },
        orderBy: { dueAt: "asc" },
        take: 5,
      }),
      prisma.note.findMany({
        where: { userId, archivedAt: null },
        orderBy: { updatedAt: "desc" },
        include: { tags: true },
        take: 5,
      }),
      prisma.gmailAppointment.findMany({
        where: {
          userId,
          appointmentDate: { gte: todayStart, lte: todayEnd },
          status: { not: "dismissed" },
        },
        orderBy: { appointmentTime: "asc" },
        select: { id: true, title: true, appointmentTime: true, location: true, status: true, sourceSubject: true },
      }),
    ]);

    openTasks = tasks;
    noteCount = notes;
    upcomingCount = upcoming.length;
    todayTasks = upcoming.filter((t: { dueAt: Date | null }) => {
      if (!t.dueAt) return false;
      return t.dueAt >= todayStart && t.dueAt <= todayEnd;
    });
    recentNotes = recent;
    appointments = gmailAppts;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {getGreeting()}, {firstName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening today
        </p>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15">
              <Calendar className="h-5 w-5 text-gold" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{appointments.length}</p>
              <p className="text-xs text-muted-foreground">Events today</p>
            </div>
          </CardContent>
        </Card>

        <Link href="/tasks">
          <Card className="border-none shadow-sm transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15">
                <CheckSquare className="h-5 w-5 text-gold" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{openTasks}</p>
                <p className="text-xs text-muted-foreground">Open tasks</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/notes">
          <Card className="border-none shadow-sm transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15">
                <StickyNote className="h-5 w-5 text-gold" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{noteCount}</p>
                <p className="text-xs text-muted-foreground">Notes</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card className="border-none shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15">
              <Clock className="h-5 w-5 text-gold" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{upcomingCount}</p>
              <p className="text-xs text-muted-foreground">Due this week</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Today's Schedule */}
        <Card className="border-none shadow-sm lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Today&apos;s Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            {appointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Calendar className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  No events scheduled for today
                </p>
                <p className="text-xs text-muted-foreground/60">
                  Enable Gmail sync in Settings to detect appointments
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {appointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold/15">
                      <Mail className="h-4 w-4 text-gold" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {apt.title}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {apt.appointmentTime && (
                          <span>{apt.appointmentTime}</span>
                        )}
                        {apt.location && (
                          <span className="flex items-center gap-0.5">
                            <MapPin className="h-3 w-3" />
                            {apt.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <AppointmentActions
                      appointmentId={apt.id}
                      status={apt.status}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tasks panel */}
        <Card className="border-none bg-foreground text-background shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-background">
                Today&apos;s Tasks
              </CardTitle>
              <Link
                href="/tasks"
                className="text-xs text-background/50 hover:text-background/80"
              >
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {todayTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckSquare className="mb-3 h-10 w-10 text-background/30" />
                <p className="text-sm text-background/70">
                  No tasks due today
                </p>
                <p className="text-xs text-background/40">
                  {openTasks > 0
                    ? `${openTasks} open task${openTasks === 1 ? "" : "s"} total`
                    : "Create tasks to track your work"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-3">
                    <div className="h-2 w-2 shrink-0 rounded-full bg-gold" />
                    <p className="flex-1 truncate text-sm text-background/90">
                      {task.title}
                    </p>
                    <Badge
                      variant="secondary"
                      className="bg-background/10 text-[10px] text-background/70"
                    >
                      {task.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Notes */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">
                Recent Notes
              </CardTitle>
              <Link
                href="/notes"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <StickyNote className="mb-3 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No notes yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentNotes.map((note) => (
                  <Link
                    key={note.id}
                    href="/notes"
                    className="block rounded-lg px-3 py-2 transition-colors hover:bg-muted/50"
                  >
                    <p className="text-sm font-medium">{note.title}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">
                        {format(note.updatedAt, "MMM d")}
                      </span>
                      {note.tags.slice(0, 3).map((t) => (
                        <Badge
                          key={t.id}
                          variant="secondary"
                          className="text-[10px]"
                        >
                          {t.tag}
                        </Badge>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions / AI */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">
                Ask LifeFlow
              </CardTitle>
              <Link
                href="/ai"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Open chat
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <Link
              href="/ai"
              className="block rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-gold/30 hover:bg-gold/5"
            >
              What do I need to do today?
            </Link>
            <p className="mt-3 text-xs text-muted-foreground/60">
              AI assistant powered by Groq
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

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
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import {
  zonedParts,
  startOfZonedDay,
  endOfZonedDay,
  addZonedDays,
  formatInTZ,
} from "@/lib/timezone";
import Link from "next/link";
import { AppointmentActions } from "@/components/dashboard/appointment-actions";
import { OnboardingCard } from "@/components/dashboard/onboarding-card";
import { DashboardTasks } from "@/components/dashboard/dashboard-tasks";

function getGreeting() {
  const hour = zonedParts(new Date()).hour;
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
  let taskList: { id: string; title: string; priority: string; dueAt: string | null }[] = [];
  let recentNotes: { id: string; title: string; updatedAt: Date; tags: { id: string; tag: string }[] }[] = [];
  let appointments: { id: string; title: string; appointmentTime: string | null; location: string | null; status: string; sourceSubject: string }[] = [];

  if (userId) {
    const now = new Date();
    const todayStart = startOfZonedDay(now);
    const todayEnd = endOfZonedDay(now);
    const weekEnd = endOfZonedDay(addZonedDays(now, 7));

    const [tasks, notes, upcoming, recent, gmailAppts, taskItems] = await Promise.all([
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
      prisma.task.findMany({
        where: { userId, status: { not: "completed" } },
        orderBy: { dueAt: "asc" },
        take: 8,
        select: { id: true, title: true, priority: true, dueAt: true },
      }),
    ]);

    openTasks = tasks;
    noteCount = notes;
    upcomingCount = upcoming.length;
    taskList = taskItems.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      dueAt: t.dueAt ? t.dueAt.toISOString() : null,
    }));
    recentNotes = recent;
    appointments = gmailAppts;
  }

  const today = formatInTZ(new Date(), {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const stats = [
    {
      value: appointments.length,
      label: "Events today",
      icon: Calendar,
      wrap: "bg-primary/12 text-primary",
    },
    {
      value: openTasks,
      label: "Open tasks",
      icon: CheckSquare,
      wrap: "bg-warning/15 text-warning",
      href: "/tasks",
    },
    {
      value: noteCount,
      label: "Notes",
      icon: StickyNote,
      wrap: "bg-success/12 text-success",
      href: "/notes",
    },
    {
      value: upcomingCount,
      label: "Due this week",
      icon: Clock,
      wrap: "bg-info/12 text-info",
    },
  ];

  return (
    <div className="flex flex-col gap-8 lg:min-h-[calc(100svh-4rem)]">
      {/* Greeting */}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-muted-foreground">{today}</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          {getGreeting()}, {firstName}
        </h1>
      </div>

      <OnboardingCard />

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((stat) => {
          const inner = (
            <Card className="h-full transition-all duration-200 group-hover/stat:-translate-y-0.5 group-hover/stat:shadow-md">
              <CardContent className="flex items-center gap-3 sm:gap-4">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl sm:h-12 sm:w-12 ${stat.wrap}`}
                >
                  <stat.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-heading text-2xl font-semibold leading-none sm:text-3xl">
                    {stat.value}
                  </p>
                  <p className="mt-1.5 text-xs font-medium text-muted-foreground">
                    {stat.label}
                  </p>
                </div>
                {stat.href && (
                  <ArrowUpRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground/40 transition-colors group-hover/stat:text-primary" />
                )}
              </CardContent>
            </Card>
          );
          return stat.href ? (
            <Link
              key={stat.label}
              href={stat.href}
              className="group/stat block"
            >
              {inner}
            </Link>
          ) : (
            <div key={stat.label}>{inner}</div>
          );
        })}
      </div>

      {/* Main content grid — schedule / tasks / notes on the left, AI on the right */}
      <div className="grid flex-1 items-stretch gap-6 lg:min-h-0 lg:auto-rows-fr lg:grid-cols-3">
        {/* Left column */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Today's Schedule */}
          <Card className="lg:flex-1">
            <CardHeader>
              <CardTitle className="font-heading text-lg">
                Today&apos;s Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              {appointments.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border py-12 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                    <Calendar className="h-6 w-6 text-muted-foreground/60" />
                  </div>
                  <p className="text-sm font-medium">Nothing on the calendar</p>
                  <p className="mt-0.5 max-w-xs text-xs text-muted-foreground">
                    Turn on Gmail sync in Settings and LifeFlow will surface
                    appointments here automatically.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {appointments.map((apt) => (
                    <div
                      key={apt.id}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-accent/50"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                        <Mail className="h-4 w-4" />
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

          {/* Tasks + Notes */}
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Tasks — sortable list */}
            <DashboardTasks tasks={taskList} openCount={openTasks} />

            {/* Recent Notes */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="font-heading text-lg">
                    Recent Notes
                  </CardTitle>
                  <Link
                    href="/notes"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    View all
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {recentNotes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                      <StickyNote className="h-6 w-6 text-muted-foreground/60" />
                    </div>
                    <p className="text-sm font-medium">No notes yet</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Jot something down and it&apos;ll show up here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {recentNotes.map((note) => (
                      <Link
                        key={note.id}
                        href="/notes"
                        className="block rounded-xl px-3 py-2.5 transition-colors hover:bg-accent/50"
                      >
                        <p className="text-sm font-medium">{note.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {formatInTZ(note.updatedAt, { month: "short", day: "numeric" })}
                          </span>
                          {note.tags.slice(0, 2).map((t) => (
                            <Badge
                              key={t.id}
                              variant="secondary"
                              className="text-xs"
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
          </div>
        </div>

        {/* Right column — Ask LifeFlow, full height */}
        <Card className="overflow-hidden bg-linear-to-br from-primary/8 to-warning/5 lg:col-span-1">
          <CardContent className="flex h-full flex-col">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-[oklch(0.62_0.2_340)] to-[oklch(0.44_0.18_320)] text-white shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="font-heading text-lg">
                  Ask LifeFlow
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Your AI assistant
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Plan your day, capture a task, or dig up a note — just ask in plain
              English.
            </p>
            <div className="mt-5 space-y-2">
              {[
                "What should I focus on today?",
                "Summarize my week so far",
                "What's on my calendar?",
                "Add a task for tomorrow",
              ].map((q) => (
                <Link
                  key={q}
                  href="/ai"
                  className="group/ask flex items-center justify-between gap-3 rounded-2xl border border-border bg-background/60 px-3.5 py-2.5 text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <span className="text-muted-foreground group-hover/ask:text-foreground">
                    {q}
                  </span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-colors group-hover/ask:text-primary" />
                </Link>
              ))}
            </div>
            <div className="mt-auto pt-6">
              <p className="mb-3 text-xs text-muted-foreground/80">
                It can create, edit, and complete items for you — deletes always
                ask first.
              </p>
              <Link
                href="/ai"
                className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md"
              >
                <Sparkles className="h-4 w-4" />
                Open assistant
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

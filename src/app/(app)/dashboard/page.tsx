import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Calendar,
  CheckSquare,
  StickyNote,
  Clock,
} from "lucide-react";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const session = await auth();
  const firstName = session?.user?.name?.split(" ")[0] ?? "there";

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
              <p className="text-2xl font-semibold">0</p>
              <p className="text-xs text-muted-foreground">Events today</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15">
              <CheckSquare className="h-5 w-5 text-gold" />
            </div>
            <div>
              <p className="text-2xl font-semibold">0</p>
              <p className="text-xs text-muted-foreground">Open tasks</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15">
              <StickyNote className="h-5 w-5 text-gold" />
            </div>
            <div>
              <p className="text-2xl font-semibold">0</p>
              <p className="text-xs text-muted-foreground">Notes</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15">
              <Clock className="h-5 w-5 text-gold" />
            </div>
            <div>
              <p className="text-2xl font-semibold">0</p>
              <p className="text-xs text-muted-foreground">Upcoming</p>
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
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No events scheduled for today
              </p>
              <p className="text-xs text-muted-foreground/60">
                Connect Google Calendar to see your schedule
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Tasks panel — dark card like the Dribbble reference */}
        <Card className="border-none bg-foreground text-background shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-background">
              Today&apos;s Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckSquare className="mb-3 h-10 w-10 text-background/30" />
              <p className="text-sm text-background/70">No tasks yet</p>
              <p className="text-xs text-background/40">
                Create tasks to track your work
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Notes */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Recent Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <StickyNote className="mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No notes yet</p>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions / AI */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Ask LifeFlow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
              What do I need to do today?
            </div>
            <p className="mt-3 text-xs text-muted-foreground/60">
              AI assistant coming soon — powered by Ollama
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { auth, signIn } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Calendar, CheckSquare, StickyNote, Bot } from "lucide-react";

const highlights = [
  { icon: Calendar, label: "Calendar" },
  { icon: CheckSquare, label: "Tasks" },
  { icon: StickyNote, label: "Notes" },
  { icon: Bot, label: "AI assistant" },
];

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      {/* Warm ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(42rem 26rem at 20% -8%, var(--ambient-1, transparent), transparent 70%), radial-gradient(40rem 24rem at 90% 108%, var(--ambient-2, transparent), transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-linear-to-br from-[oklch(0.62_0.2_340)] to-[oklch(0.44_0.18_320)] font-heading text-3xl font-semibold text-white shadow-lg">
            L
          </span>
          <div className="space-y-1.5">
            <h1 className="font-heading text-4xl font-semibold tracking-tight">
              LifeFlow
            </h1>
            <p className="text-pretty text-sm text-muted-foreground">
              Your calm, personal hub for calendar, tasks, notes, and an AI
              that ties them together.
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/dashboard" });
            }}
          >
            <button
              type="submit"
              className="flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-border bg-background text-sm font-medium shadow-sm transition-all hover:-translate-y-px hover:bg-accent hover:shadow-md"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </button>
          </form>

          <div className="mt-5 flex items-center justify-center gap-5">
            {highlights.map((h) => (
              <div
                key={h.label}
                className="flex flex-col items-center gap-1.5 text-muted-foreground"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                  <h.icon className="h-4 w-4" />
                </span>
                <span className="text-[0.65rem] font-medium">{h.label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          A private space for you and a few friends.
        </p>
      </div>
    </div>
  );
}

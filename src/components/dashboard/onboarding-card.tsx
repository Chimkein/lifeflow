"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Circle, Sparkles, X } from "lucide-react";

const DISMISS_KEY = "lifeflow-onboarding-dismissed";

export function OnboardingCard() {
  const [loaded, setLoaded] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [triedAI, setTriedAI] = useState(false);

  useEffect(() => {
    const isDismissed = localStorage.getItem(DISMISS_KEY) === "1";
    (async () => {
      try {
        const [tg, conv] = await Promise.all([
          fetch("/api/telegram/settings").then((r) => r.json()).catch(() => ({})),
          fetch("/api/ai/conversations").then((r) => r.json()).catch(() => []),
        ]);
        setTelegramConnected(!!tg?.connected);
        setTriedAI(Array.isArray(conv) && conv.length > 0);
      } finally {
        setDismissed(isDismissed);
        setLoaded(true);
      }
    })();
  }, []);

  const steps = [
    {
      done: true,
      title: "Sign in",
      desc: "You're in — your Google Calendar and Gmail are connected.",
    },
    {
      done: telegramConnected,
      title: "Connect Telegram",
      desc: "Get daily briefings and chat with your bot on the go.",
      href: "/settings",
    },
    {
      done: triedAI,
      title: "Try the AI assistant",
      desc: "Ask it to plan your day, or add a task for you.",
      href: "/ai",
    },
  ];

  const allDone = steps.every((s) => s.done);
  if (!loaded || dismissed || allDone) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <Card className="relative overflow-hidden border-primary/15 bg-linear-to-br from-primary/8 to-warning/5">
      <button
        onClick={dismiss}
        className="absolute right-4 top-4 z-10 text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="px-(--card-spacing)">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-heading text-lg font-semibold">
              Welcome to LifeFlow
            </h3>
            <p className="text-sm text-muted-foreground">
              A couple of quick steps to get set up.
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {steps.map((s) => (
            <div
              key={s.title}
              className="flex items-center gap-3 rounded-xl bg-card/70 px-3.5 py-2.5"
            >
              {s.done ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-muted-foreground/50" />
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium ${
                    s.done ? "text-muted-foreground line-through" : ""
                  }`}
                >
                  {s.title}
                </p>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
              {!s.done && s.href && (
                <Link
                  href={s.href}
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md"
                >
                  Go
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

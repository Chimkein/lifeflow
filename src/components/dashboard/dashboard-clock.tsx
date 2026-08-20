"use client";

import { useEffect, useState } from "react";
import { useTimezone } from "@/components/timezone-provider";

function read(tz: string): { time: string; zoneName: string } {
  const now = new Date();
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(now);
  const zoneName =
    new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
      .formatToParts(now)
      .find((p) => p.type === "timeZoneName")?.value ?? "";
  return { time, zoneName };
}

// Live clock in the user's saved timezone. Ticks every second. Stays a stable
// placeholder until the client has mounted (state starts null) so server HTML
// and client hydration always match — the time is only known on the client.
export function DashboardClock() {
  const tz = useTimezone();
  const [now, setNow] = useState<{ time: string; zoneName: string } | null>(null);

  useEffect(() => {
    const tick = () => setNow(read(tz));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tz]);

  const city = tz.split("/").pop()?.replace(/_/g, " ") ?? tz;

  return (
    <div className="flex flex-col items-start sm:items-end" aria-live="off">
      <p className="font-heading text-3xl font-semibold tabular-nums leading-none sm:text-4xl">
        {now ? now.time : "——:——"}
      </p>
      <p className="mt-1.5 text-xs font-medium text-muted-foreground">
        {now?.zoneName ? `${now.zoneName} · ${city}` : city}
      </p>
    </div>
  );
}

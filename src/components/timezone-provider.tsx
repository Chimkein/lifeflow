"use client";

import { createContext, useContext } from "react";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";

// The user's saved IANA timezone, provided by the (app) server layout so any
// client component can render schedule times in the user's own zone. A consumer
// rendered outside the provider falls back to the app default.
const TimezoneContext = createContext<string>(DEFAULT_TIMEZONE);

export function TimezoneProvider({
  timezone,
  children,
}: {
  timezone: string;
  children: React.ReactNode;
}) {
  return (
    <TimezoneContext.Provider value={timezone}>
      {children}
    </TimezoneContext.Provider>
  );
}

export function useTimezone(): string {
  return useContext(TimezoneContext);
}

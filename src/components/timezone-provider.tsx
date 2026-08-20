"use client";

import { createContext, useContext } from "react";

// The user's saved IANA timezone, provided by the (app) server layout so any
// client component can render schedule times in the user's own zone rather than
// the browser's. Falls back to the browser zone if somehow unset.
const TimezoneContext = createContext<string>("Asia/Manila");

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

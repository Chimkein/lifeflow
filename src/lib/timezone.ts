const DEFAULT_TIMEZONE = process.env.USER_TIMEZONE ?? "Asia/Manila";

export function userNow(timezone = DEFAULT_TIMEZONE): Date {
  const now = new Date();
  const utcStr = now.toLocaleString("en-US", { timeZone: "UTC" });
  const tzStr = now.toLocaleString("en-US", { timeZone: timezone });
  const offsetMs = new Date(tzStr).getTime() - new Date(utcStr).getTime();
  return new Date(now.getTime() + offsetMs);
}

import { TZDate } from "@date-fns/tz";

const DEFAULT_TIMEZONE = process.env.USER_TIMEZONE ?? "Asia/Manila";

export function userNow(timezone = DEFAULT_TIMEZONE): Date {
  return new TZDate(new Date(), timezone);
}

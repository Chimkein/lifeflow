import { NextResponse } from "next/server";
import { ValidationError } from "@/lib/validation";

/**
 * If `e` is a ValidationError, return a clean 400 with its (safe) message.
 * Otherwise return null so the caller can rethrow / handle it generically.
 */
export function validationError(e: unknown): NextResponse | null {
  if (e instanceof ValidationError) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
  return null;
}

export function tooManyRequests(retryAfter: number): NextResponse {
  return NextResponse.json(
    { error: "Too many requests. Please slow down and try again shortly." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}

# LifeFlow Repo Audit

## Verdict

Audit goal **MET**: all raw findings were adjudicated against source, every confirmed safe-mechanical fix was applied, and post-fix checks show no regression. Two applied fixes carry open blockers (migrations not generated; `.env.example` not updated) — see Fixes applied.

- **Total raw findings:** 24
- **Confirmed:** 22 (collapsing to ~19 unique issues after dedup; the fail-open cron/webhook issue was reported 6 times)
- **Refuted:** 1 (correctness-4)
- **Uncertain:** 1 (correctness-5)
- **Auto-fixed:** 9 unique confirmed issues across 7 files

## Baseline verification

| Check | Result | Real code error? |
|---|---|---|
| `npx tsc --noEmit` | Pass (exit 0, no output) | n/a |
| `npm run lint` | Fail (exit 1): 1 error + 3 warnings | Yes — real, but pre-existing and out of audit scope |
| `npx next build` | Pass (exit 0, 27 routes generated) | n/a |

The single lint error is `react-hooks/set-state-in-effect` in `src/app/(app)/ai/page.tsx:60`. No baseline failure was env/DB-related — the build compiled and typechecked cleanly against `.env`.

## Confirmed findings (survived audit)

Ranked by adjudicated severity. No finding survived at critical (auditor downgraded all originally-critical items to high).

| Severity | Dimension | file:line | Issue | Fixed? |
|---|---|---|---|---|
| high | auth | src/app/api/cron/briefing/route.ts:12 | Cron briefing endpoint fails open when CRON_SECRET unset | yes |
| high | auth | src/app/api/cron/gmail-sync/route.ts:8 | Gmail-sync cron endpoint fails open when CRON_SECRET unset | yes |
| high | auth | src/app/api/telegram/webhook/route.ts:14 | Telegram webhook fails open when TELEGRAM_WEBHOOK_SECRET unset (spoofable updates, link-code brute force) | yes |
| high | correctness | src/lib/timezone.ts:3 | `userNow()` fabricates a Date whose epoch is wrong by the TZ offset; only safe for local-getter display | no |
| high | correctness | src/lib/briefing.ts:225 | Fabricated "today" sent via toISOString() to Google Calendar timeMin/timeMax, shifting the day window (same in ollama.ts) | no |
| high | correctness | src/lib/briefing.ts:29 | Fabricated "today" used as Prisma gte/lte bounds against real instants, mis-bucketing due-today/this-week (also dashboard/page.tsx, ollama.ts) | no |
| high | datamodel | prisma/migrations/20260818065513_add_ai_chat/migration.sql:3 | DB default `llama3.1:8b` diverges from schema's `openai/gpt-oss-20b`; new users get an invalid model, breaking AI chat/briefing | yes |
| medium | injection | src/lib/gmail-appointments.ts:38 | Untrusted Gmail content concatenated verbatim into LLM prompt (indirect injection source); persisted and re-fed into system prompt | no |
| medium | injection | src/lib/telegram-bot.ts:168 | Raw LLM output sent to Telegram with parseMode HTML unescaped; stray `<` → HTTP 400 → user silently gets no reply (also briefing.ts:213) | no |
| medium | secrets | .env:3 | Live Neon/Google/Telegram/Groq credentials in plaintext working-tree .env (gitignored); operational risk, rotate | no |
| medium | secrets | .env:25 | TELEGRAM_WEBHOOK_SECRET / CRON_SECRET left at guessable `-change-me` placeholders | no |
| medium | secrets | prisma/schema.prisma:47 | OAuth access/refresh tokens stored plaintext; ENCRYPTION_KEY defined but never referenced in src/ | no |
| low | secrets | docker-compose.yml:8 | Weak hardcoded Postgres password + port published on 0.0.0.0 | yes (port only) |
| low | correctness | src/lib/briefing.ts:224 | Calendar fetch errors swallowed as "zero events", hiding REAUTH_REQUIRED (also ollama.ts) | no |
| low | correctness | src/app/api/ai/chat/route.ts:119 | Recovery path (prisma create / enqueue) can throw past finally → unhandled rejection in stream start() | yes |
| low | correctness | src/app/(app)/ai/page.tsx:119 | AbortController created/stored but `.abort()` never called; dead cancellation code | no |
| low | datamodel | prisma/schema.prisma:42 | No index on Account.userId despite direct queries + cascade delete | yes |
| low | datamodel | prisma/schema.prisma:62 | Session model has no primary key and no userId index | yes |
| low | datamodel | prisma/schema.prisma:178 | TaskNote has no index for noteId lookups, which the app performs | yes |

## Fixes applied

- **src/app/api/cron/briefing/route.ts** — line 12 guard changed to `if (!cronSecret || authHeader !== \`Bearer ${cronSecret}\`)`; endpoint now 401s when CRON_SECRET unset. *Blocker:* implementor did not add CRON_SECRET to `.env.example` (single-file scope conflict) — still needs documenting.
- **src/app/api/cron/gmail-sync/route.ts** — line 8 guard changed to fail-closed identically. No other changes.
- **src/app/api/telegram/webhook/route.ts** — line 14 changed to `if (!expectedSecret || secret !== expectedSecret)`; now 401s when the secret is unset. Rate-limiting on link-code (called out in finding) deliberately not done — separate non-mechanical hardening.
- **docker-compose.yml** — port mapping changed `5432:5432` → `127.0.0.1:5432:5432` (loopback only). Weak password left as-is (out of scope).
- **src/app/api/ai/chat/route.ts** — wrapped the SSE catch-block recovery (`prisma.chatMessage.create` + `controller.enqueue`) in a nested try/catch logging via `console.error`; `finally { controller.close() }` untouched.
- **prisma/migrations/20260818065513_add_ai_chat/migration.sql** — line 3 default changed `'llama3.1:8b'` → `'openai/gpt-oss-20b'` to match schema. *Caveat:* editing an existing migration in place does NOT fix any database it was already applied to; a corrective `ALTER TABLE ... SET DEFAULT` migration was requested but not generated (no DB connection / single-file scope).
- **prisma/schema.prisma** — added `@@index([userId, provider])` to Account; added `id String @id @default(cuid())` + `@@index([userId])` to Session; added `@@index([noteId])` to TaskNote. `prisma validate` passed. *Blocker:* migrations for these three schema changes were NOT generated (single-file scope restriction) — they are inert until someone runs `prisma migrate dev`.

## Re-verification

| Check | Baseline | Post-fix | Verdict |
|---|---|---|---|
| tsc | Pass (0) | Pass (0) | Same |
| Lint | Fail: 1 error + 3 warnings | Fail: 1 error + 3 warnings | Same — no new lint issues |
| Build | Pass (0), 27 routes | Pass (0), 27 routes | Same |

No regression. The persisting lint error (`ai/page.tsx:60` set-state-in-effect) and 3 warnings are byte-identical pre and post; none of the applied fixes touched those lines. tsc and build remain green.

## Refuted / uncertain (not acted on)

These are **not confirmed** and were correctly left alone:

- **correctness-4 (REFUTED)** — "Per-user User.timezone field never read." False premise: the schema has no `User.timezone`; the `timezone` field at schema line 107 belongs to `CalendarEvent`. The weaker true fact (all `userNow()` calls use the global default) is real but is a single-region design choice, not an unused-field bug.
- **correctness-5 (UNCERTAIN)** — "Cron briefing fires at wrong/never time." TZ-fragility and per-user-tz prongs are overclaimed (UTC runtime + no per-user tz). The one real kernel — exact HH:MM string match with no tolerance window can skip a send if cron doesn't fire on the minute — could not be verified: no `vercel.json` in repo, so cron cadence is unknown.

## Recommended next (not auto-fixed)

Confirmed findings needing human/design decisions, prioritized:

1. **Timezone rework (high, correctness-1/2/3)** — Replace `userNow()`'s fabricated Date with real UTC instants (date-fns-tz `zonedTimeToUtc` or Temporal) for all DB-query bounds, Google Calendar timeMin/timeMax, and Prisma filters. Broad blast radius: briefing.ts, ollama.ts, dashboard/page.tsx. Root cause of the day-window/due-date bugs.
2. **Generate the pending migrations (high/low, datamodel-1/2/3/4)** — The schema index changes and the ollamaModel default fix are inert or DB-drifting until `prisma migrate dev` is run and the migration files committed. Also verify already-applied databases get the corrective `ALTER COLUMN ... SET DEFAULT`.
3. **Rotate and relocate secrets (medium, secrets-3/4)** — Rotate the exposed live Neon/Google/Telegram/Groq credentials; replace `-change-me` placeholder secrets with `openssl rand -hex 32` values; document CRON_SECRET (and the now-required TELEGRAM_WEBHOOK_SECRET) in `.env.example`.
4. **Prompt-injection hardening (medium, injection-1/2)** — Sanitize/delimit Gmail-derived text before it enters any prompt, re-validate LLM JSON before persisting, and HTML-escape (or send plaintext) all LLM output going to Telegram to stop silent HTTP 400 reply drops.
5. **Encrypt OAuth tokens at rest (medium, secrets-5)** — Implement envelope encryption with the already-present ENCRYPTION_KEY across read/write sites, plus row migration — or remove the unused key if out of scope.
6. **Surface calendar reauth (low, correctness-6)** — Propagate REAUTH_REQUIRED instead of returning `[]` so users are prompted to reconnect rather than seeing "no events."
7. **Resolve dead AbortController (low, correctness-8)** — Wire a Stop button to `abortRef.current.abort()` or remove the unused controller/AbortError branch.

## Meta

- **Nodes:** findings span 5 dimensions (auth, injection, secrets, correctness, datamodel); the fail-open cron/webhook issue was independently reported 6 times and deduped to 3 file-level issues.
- **Disagreements:** none substantive between nodes on facts; the auditor systematically downgraded originally-claimed severities (several critical→high, high→medium/low) and raised injection-3/secrets-2 to high for consistency with auth-3. All are the same underlying issues, reconciled.
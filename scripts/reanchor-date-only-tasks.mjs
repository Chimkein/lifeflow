// One-time cleanup for tasks created before per-user timezones existed.
//
// Old date-only tasks were stored at UTC midnight (e.g. 2026-08-21T00:00:00Z).
// Displayed in a negative-offset zone (e.g. PDT) that instant is the *previous*
// evening, so the task appears a day early and picks up a bogus time. This
// re-anchors each such task to LOCAL midnight in its owner's saved timezone, so
// it renders cleanly as an all-day task on the intended calendar date.
//
// IMPORTANT: each user must set their correct timezone in Settings FIRST — the
// re-anchor uses whatever zone is currently saved on the account.
//
// Dry-run by default. Pass --apply to write.
//
//   node scripts/reanchor-date-only-tasks.mjs          (preview)
//   node scripts/reanchor-date-only-tasks.mjs --apply  (write)

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { zonedYmd, wallTimeToInstant, DEFAULT_TIMEZONE } from "../src/lib/timezone.ts";

const APPLY = process.argv.includes("--apply");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const tasks = await prisma.task.findMany({
  where: { dueAt: { not: null } },
  select: { id: true, title: true, dueAt: true, user: { select: { timezone: true } } },
});

let changed = 0;
let skipped = 0;

for (const t of tasks) {
  const d = t.dueAt;
  const isUtcMidnight =
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0;

  if (!isUtcMidnight) {
    skipped++;
    continue; // already has a specific time (new-style / timed task)
  }

  const tz = t.user?.timezone ?? DEFAULT_TIMEZONE;
  // The date the user actually sees for this task in their zone.
  const localDate = zonedYmd(d, tz);
  const reanchored = wallTimeToInstant(localDate, null, tz); // local midnight

  if (!reanchored || reanchored.getTime() === d.getTime()) {
    skipped++;
    continue; // no change needed (e.g. already local midnight, or UTC user)
  }

  console.log(
    `${APPLY ? "UPDATE" : "would update"}  "${t.title.slice(0, 32)}"  ${d.toISOString()} -> ${reanchored.toISOString()}  (${tz}, shows ${localDate})`
  );

  if (APPLY) {
    await prisma.task.update({ where: { id: t.id }, data: { dueAt: reanchored } });
  }
  changed++;
}

console.log(
  `\n${APPLY ? "Applied" : "Dry run"}: ${changed} task(s) re-anchored, ${skipped} left unchanged.` +
    (APPLY ? "" : "\nRe-run with --apply to write.")
);

await prisma.$disconnect();

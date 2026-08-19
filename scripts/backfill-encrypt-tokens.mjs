/*
 * One-time backfill: encrypt legacy plaintext OAuth tokens in the Account table.
 *
 * RUN THIS ONLY AFTER the encryption code is deployed to the environment whose
 * database you are targeting. Encrypting tokens while the old (plaintext-reading)
 * code is still live will break Google Calendar/Gmail until the new code ships.
 *
 * Reads DATABASE_URL and ENCRYPTION_KEY from the environment (.env via dotenv).
 * Idempotent: values already in "v1:" form are skipped.
 *
 *   node scripts/backfill-encrypt-tokens.mjs           # dry run (reports only)
 *   node scripts/backfill-encrypt-tokens.mjs --apply   # actually writes
 */
import "dotenv/config";
import { createCipheriv, randomBytes } from "crypto";
import pg from "pg";

const { Client } = pg;
const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const FIELDS = ["access_token", "refresh_token", "id_token"];
const APPLY = process.argv.includes("--apply");

function getKey() {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) throw new Error("ENCRYPTION_KEY is not set");
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex characters)");
  return key;
}

function isEncrypted(v) {
  return typeof v === "string" && v.startsWith(`${VERSION}:`);
}

function encryptToken(plain) {
  if (plain == null) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString("hex")}:${tag.toString("hex")}:${ct.toString("hex")}`;
}

getKey(); // validate up front
const c = new Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const { rows } = await c.query(
  'select provider, "providerAccountId", access_token, refresh_token, id_token from "Account"'
);
console.log(`Scanning ${rows.length} account row(s). Mode: ${APPLY ? "APPLY" : "DRY RUN"}`);

let changedRows = 0;
let changedFields = 0;
for (const row of rows) {
  const updates = {};
  for (const f of FIELDS) {
    const v = row[f];
    if (v != null && !isEncrypted(v)) {
      updates[f] = encryptToken(v);
      changedFields++;
    }
  }
  const keys = Object.keys(updates);
  if (keys.length === 0) continue;
  changedRows++;
  console.log(`  ${row.provider}/${row.providerAccountId}: will encrypt [${keys.join(", ")}]`);
  if (APPLY) {
    const set = keys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");
    const vals = keys.map((k) => updates[k]);
    vals.push(row.provider, row.providerAccountId);
    await c.query(
      `update "Account" set ${set} where provider = $${keys.length + 1} and "providerAccountId" = $${keys.length + 2}`,
      vals
    );
  }
}

console.log(
  `${APPLY ? "Encrypted" : "Would encrypt"} ${changedFields} field(s) across ${changedRows} row(s).`
);
if (!APPLY && changedRows > 0) console.log("Re-run with --apply to write changes.");
await c.end();

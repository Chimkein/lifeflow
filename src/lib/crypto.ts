import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Envelope encryption for secrets at rest (OAuth tokens). AES-256-GCM with a
// random 96-bit IV per value. Stored form: "v1:<ivHex>:<tagHex>:<ctHex>".
//
// decryptToken() passes through values that are not in our format, so rows that
// still hold legacy plaintext keep working until a one-time backfill re-encrypts
// them. Because of that passthrough, decrypting plaintext never needs the key —
// only encrypting, or decrypting an actual "v1:" value, does.

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) {
    throw new Error("ENCRYPTION_KEY is not set");
  }
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex characters)");
  }
  return key;
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(`${VERSION}:`);
}

export function encryptToken(plain: string | null | undefined): string | null {
  if (plain == null) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString("hex")}:${tag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decryptToken(stored: string | null | undefined): string | null {
  if (stored == null) return null;
  // Legacy plaintext (or anything not in our format) passes through unchanged.
  if (!isEncrypted(stored)) return stored;
  const parts = stored.split(":");
  if (parts.length !== 4) return stored;
  const [, ivHex, tagHex, ctHex] = parts;
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(ctHex, "hex")),
    decipher.final(),
  ]);
  return plain.toString("utf8");
}

import { describe, it, expect, beforeAll } from "vitest";
import { encryptToken, decryptToken, isEncrypted } from "./crypto";

// crypto.ts reads ENCRYPTION_KEY lazily (per call), so setting it here — before
// any encrypt/decrypt runs — is sufficient. Fixed 32-byte test key.
beforeAll(() => {
  process.env.ENCRYPTION_KEY = "0".repeat(64);
});

describe("token encryption", () => {
  it("round-trips a value", () => {
    const secret = "ya29.a0AfB_byC-some-access-token";
    const enc = encryptToken(secret);
    expect(enc).not.toBe(secret);
    expect(isEncrypted(enc)).toBe(true);
    expect(decryptToken(enc)).toBe(secret);
  });

  it("returns null for null/undefined", () => {
    expect(encryptToken(null)).toBeNull();
    expect(encryptToken(undefined)).toBeNull();
    expect(decryptToken(null)).toBeNull();
    expect(decryptToken(undefined)).toBeNull();
  });

  it("uses a fresh IV each time (ciphertexts differ, plaintext recovers)", () => {
    const a = encryptToken("same-value");
    const b = encryptToken("same-value");
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe("same-value");
    expect(decryptToken(b)).toBe("same-value");
  });

  it("passes through legacy plaintext unchanged", () => {
    // Real Google tokens never start with "v1:", so plaintext is detected as such.
    expect(decryptToken("1//0eXaMpLe-refresh-token")).toBe("1//0eXaMpLe-refresh-token");
    expect(isEncrypted("1//0eXaMpLe-refresh-token")).toBe(false);
  });

  it("rejects a tampered ciphertext", () => {
    const enc = encryptToken("secret")!;
    const parts = enc.split(":");
    // Flip a byte in the ciphertext segment.
    parts[3] = parts[3].replace(/.$/, (ch) => (ch === "0" ? "1" : "0"));
    expect(() => decryptToken(parts.join(":"))).toThrow();
  });
});

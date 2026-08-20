import { prisma } from "@/lib/db";
import { encryptToken, decryptToken } from "@/lib/crypto";

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export async function getValidAccessToken(userId: string): Promise<string> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  });

  if (!account) {
    throw new Error("NO_GOOGLE_ACCOUNT");
  }

  const accessToken = decryptToken(account.access_token);
  const refreshToken = decryptToken(account.refresh_token);

  const now = Math.floor(Date.now() / 1000);
  if (account.expires_at && account.expires_at > now + 60) {
    return accessToken!;
  }

  if (!refreshToken) {
    throw new Error("NO_REFRESH_TOKEN");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    if (error.error === "invalid_grant") {
      throw new Error("REAUTH_REQUIRED");
    }
    throw new Error(`Token refresh failed: ${res.status}`);
  }

  const tokens: GoogleTokenResponse = await res.json();

  await prisma.account.update({
    where: {
      provider_providerAccountId: {
        provider: account.provider,
        providerAccountId: account.providerAccountId,
      },
    },
    data: {
      access_token: encryptToken(tokens.access_token),
      expires_at: now + tokens.expires_in,
    },
  });

  return tokens.access_token;
}

export async function hasGmailScope(userId: string): Promise<boolean> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
    select: { scope: true },
  });
  return account?.scope?.includes("gmail.readonly") ?? false;
}

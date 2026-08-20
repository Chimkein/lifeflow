import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { encryptToken } from "@/lib/crypto";

// Wrap the Prisma adapter so the OAuth tokens it persists on first link are
// encrypted at rest. Reads elsewhere go through decryptToken().
const baseAdapter = PrismaAdapter(prisma);
const adapter: typeof baseAdapter = {
  ...baseAdapter,
  linkAccount: (account) =>
    baseAdapter.linkAccount!({
      ...account,
      access_token: encryptToken(account.access_token) ?? undefined,
      refresh_token: encryptToken(account.refresh_token) ?? undefined,
      id_token: encryptToken(account.id_token) ?? undefined,
    }),
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
          scope:
            "openid email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.readonly",
        },
      },
    }),
  ],
  session: {
    strategy: "database",
    maxAge: 60 * 60 * 24 * 7, // 7-day absolute session lifetime
    updateAge: 60 * 60 * 24, // slide the expiry at most once per day
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ account, profile }) {
      // Optional allow-list. When ALLOWED_EMAILS is set (comma-separated), only
      // those Google accounts may sign in — the intended posture for an
      // unadvertised / portfolio deployment, so random visitors can't create
      // accounts and burn AI/Gmail quota or storage. Unset = open sign-up.
      const allowed = (process.env.ALLOWED_EMAILS ?? "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (allowed.length > 0) {
        const email = profile?.email?.toLowerCase();
        if (!email || !allowed.includes(email)) return false;
      }

      if (account?.provider === "google") {
        await prisma.account.updateMany({
          where: {
            provider: account.provider,
            providerAccountId: account.providerAccountId,
          },
          data: {
            // `?? undefined` so an absent field is SKIPPED (preserving the
            // stored value) rather than written as NULL — matching the adapter
            // wrap above and the pre-encryption behavior.
            access_token: encryptToken(account.access_token) ?? undefined,
            refresh_token: encryptToken(account.refresh_token) ?? undefined,
            expires_at: account.expires_at,
            scope: account.scope,
            id_token: encryptToken(account.id_token) ?? undefined,
          },
        });
      }
      return true;
    },
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});

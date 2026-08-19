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
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ account }) {
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

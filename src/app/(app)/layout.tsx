import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { SessionProvider } from "@/components/session-provider";
import { TimezoneProvider } from "@/components/timezone-provider";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";
import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "sonner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  // DEV_BYPASS_AUTH lets the UI render without a session for local layout
  // work; the NODE_ENV guard keeps it inert in production builds.
  const devBypass =
    process.env.NODE_ENV === "development" &&
    process.env.DEV_BYPASS_AUTH === "1";
  if (!session && !devBypass) redirect("/login");

  // Load the user's saved timezone once and provide it to all client
  // components so schedule times render in the user's own zone.
  const userId = session?.user?.id;
  const timezone = userId
    ? (
        await prisma.user.findUnique({
          where: { id: userId },
          select: { timezone: true },
        })
      )?.timezone ?? DEFAULT_TIMEZONE
    : DEFAULT_TIMEZONE;

  return (
    <SessionProvider>
      <TimezoneProvider timezone={timezone}>
        <div className="app-ambient flex min-h-svh w-full">
          <AppSidebar />
          <main className="relative flex min-w-0 flex-1 flex-col p-4 pb-24 md:p-8 md:pb-8">
            <div className="mx-auto w-full max-w-[1760px]">{children}</div>
          </main>
        </div>
        <Toaster richColors position="top-right" theme="system" closeButton />
      </TimezoneProvider>
    </SessionProvider>
  );
}

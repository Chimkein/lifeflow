import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SessionProvider } from "@/components/session-provider";
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

  return (
    <SessionProvider>
      <div className="app-ambient flex min-h-svh w-full">
        <AppSidebar />
        <main className="relative flex min-w-0 flex-1 flex-col p-4 pb-24 md:p-8 md:pb-8">
          <div className="mx-auto w-full max-w-[1760px]">{children}</div>
        </main>
      </div>
      <Toaster richColors position="top-right" theme="system" closeButton />
    </SessionProvider>
  );
}

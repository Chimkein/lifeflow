import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SessionProvider } from "@/components/session-provider";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
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
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-4 border-b border-border bg-background/95 px-4 backdrop-blur-sm lg:px-6">
            <SidebarTrigger />
          </header>
          <div className="flex flex-1 flex-col p-4 lg:p-6">{children}</div>
        </SidebarInset>
        <Toaster richColors position="top-right" theme="system" closeButton />
      </SidebarProvider>
    </SessionProvider>
  );
}

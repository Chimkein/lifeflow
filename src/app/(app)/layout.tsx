import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SessionProvider } from "@/components/session-provider";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <SessionProvider>
      <SidebarProvider>
        <AppSidebar />
        <main className="flex flex-1 flex-col">
          <header className="flex h-14 items-center gap-4 border-b border-border px-4 lg:px-6">
            <SidebarTrigger />
          </header>
          <div className="flex-1 p-4 lg:p-6">{children}</div>
        </main>
      </SidebarProvider>
    </SessionProvider>
  );
}

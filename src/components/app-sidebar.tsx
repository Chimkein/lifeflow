"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Calendar,
  StickyNote,
  CheckSquare,
  Bot,
  Settings,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Calendar", href: "/calendar", icon: Calendar },
  { title: "Notes", href: "/notes", icon: StickyNote },
  { title: "Tasks", href: "/tasks", icon: CheckSquare },
  { title: "AI", href: "/ai", icon: Bot },
];

const railItem =
  "group relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring active:bg-sidebar-accent";
const railIcon =
  "h-5 w-5 transition-transform duration-200 ease-out group-hover:scale-110 group-active:scale-90";
const idle =
  "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground";
const active = "bg-sidebar-accent text-primary";

function ActiveDot() {
  return (
    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 animate-in rounded-r-full bg-primary fade-in slide-in-from-left-1 duration-300" />
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user;

  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- next-themes hydration guard; the resolved theme is only known after mount
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";
  const settingsActive = pathname === "/settings";

  // Flip the theme as a single GPU-composited cross-fade via the View
  // Transitions API. Its cost is independent of how many elements are on
  // screen, so a data-packed dashboard animates as smoothly as an empty one —
  // unlike a per-element color transition, whose cost scales with the DOM.
  // Falls back to an instant swap where the API is unsupported or motion is
  // reduced.
  const toggleTheme = () => {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    const doc = document as Document & {
      startViewTransition?: (callback: () => void) => unknown;
    };
    if (
      !doc.startViewTransition ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setTheme(next);
      return;
    }
    doc.startViewTransition(() => flushSync(() => setTheme(next)));
  };

  const accountItems = () => (
    <>
      <div className="flex flex-col gap-0.5 px-1.5 py-1.5">
        <span className="truncate text-sm font-medium text-foreground">
          {user?.name ?? "User"}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {user?.email ?? ""}
        </span>
      </div>
      <DropdownMenuSeparator />
      <DropdownMenuItem render={<Link href="/settings" />}>
        <Settings className="h-4 w-4" />
        Settings
      </DropdownMenuItem>
      <DropdownMenuItem onClick={toggleTheme}>
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        {mounted ? (isDark ? "Light mode" : "Dark mode") : "Theme"}
      </DropdownMenuItem>
      <DropdownMenuItem
        variant="destructive"
        onClick={() => signOut({ callbackUrl: "/login" })}
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </DropdownMenuItem>
    </>
  );

  return (
    <>
      {/* Desktop / tablet — vertical icon rail */}
      <TooltipProvider delay={250}>
        <aside
          data-slot="app-rail"
          className="sticky top-3 z-30 m-3 hidden h-[calc(100svh-1.5rem)] w-16 shrink-0 flex-col items-center gap-1 rounded-[1.75rem] border border-sidebar-border bg-sidebar/60 py-3 shadow-lg backdrop-blur-xl md:flex"
        >
          {/* Brand */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Link
                  href="/dashboard"
                  aria-label="LifeFlow home"
                  className="mb-1 flex h-11 w-11 items-center justify-center transition-transform hover:-translate-y-0.5"
                />
              }
            >
              <span
                aria-hidden
                className="h-11 w-11 bg-contain bg-center bg-no-repeat drop-shadow-md"
                style={{ backgroundImage: "url('/logo.png')" }}
              />
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={10}>
              LifeFlow
            </TooltipContent>
          </Tooltip>

          {/* Primary navigation */}
          <nav className="flex flex-1 flex-col items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger
                    render={
                      <Link
                        href={item.href}
                        aria-label={item.title}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(railItem, isActive ? active : idle)}
                      />
                    }
                  >
                    <item.icon className={railIcon} />
                    {isActive && <ActiveDot />}
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={10}>
                    {item.title}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>

          {/* Utilities */}
          <div className="flex flex-col items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label={
                      !mounted
                        ? "Toggle theme"
                        : isDark
                          ? "Switch to light mode"
                          : "Switch to dark mode"
                    }
                    onClick={toggleTheme}
                    className={cn(railItem, idle)}
                  />
                }
              >
                {mounted ? (
                  isDark ? (
                    <Sun className={cn(railIcon, "theme-swap")} />
                  ) : (
                    <Moon className={cn(railIcon, "theme-swap")} />
                  )
                ) : (
                  <Sun className="h-5 w-5 opacity-0" />
                )}
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                Theme
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Link
                    href="/settings"
                    aria-label="Settings"
                    aria-current={settingsActive ? "page" : undefined}
                    className={cn(railItem, settingsActive ? active : idle)}
                  />
                }
              >
                <Settings className={railIcon} />
                {settingsActive && <ActiveDot />}
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                Settings
              </TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    aria-label="Account menu"
                    className="mt-1 rounded-full outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                  />
                }
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user?.image ?? undefined} />
                  <AvatarFallback className="bg-primary/15 text-sm font-semibold text-primary">
                    {user?.name?.charAt(0) ?? "?"}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="right"
                align="end"
                sideOffset={12}
                className="w-56"
              >
                {accountItems()}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>
      </TooltipProvider>

      {/* Phones — bottom navigation bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around gap-1 border-t border-sidebar-border bg-sidebar/80 px-1.5 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.title}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group flex flex-1 flex-col items-center gap-1 py-1 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                  isActive
                    ? "bg-primary/15"
                    : "group-active:bg-sidebar-accent/60"
                )}
              >
                <item.icon className="h-[1.3rem] w-[1.3rem] transition-transform duration-200 group-active:scale-90" />
              </span>
              <span className="text-[0.62rem] font-medium">{item.title}</span>
            </Link>
          );
        })}

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label="Account menu"
                className="group flex flex-1 flex-col items-center gap-1 py-1 text-muted-foreground outline-none"
              />
            }
          >
            <span className="flex h-7 w-12 items-center justify-center rounded-full transition-colors group-active:bg-sidebar-accent/60 group-data-[popup-open]:bg-primary/15 group-data-[popup-open]:text-primary">
              <Avatar className="h-[1.3rem] w-[1.3rem]">
                <AvatarImage src={user?.image ?? undefined} />
                <AvatarFallback className="bg-primary/15 text-[0.6rem] font-semibold text-primary">
                  {user?.name?.charAt(0) ?? "?"}
                </AvatarFallback>
              </Avatar>
            </span>
            <span className="text-[0.62rem] font-medium">Account</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="end"
            sideOffset={12}
            className="w-56"
          >
            {accountItems()}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </>
  );
}

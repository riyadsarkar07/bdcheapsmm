"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, LogOut, Menu, Settings } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, getInitials } from "@/lib/utils";
import {
  SidebarLink,
  type SidebarGroup,
  type SidebarItem,
} from "@/components/layout/sidebar-nav";
import { signOutAction } from "@/lib/actions/auth";
import type { Profile } from "@/lib/types/database";

const STORAGE_KEY = "bdcheapsmm:sidebar-collapsed";

export function DashboardShell({
  profile,
  groups,
  brandBadge,
  footerItem,
  headerExtras,
  children,
}: {
  profile: Profile;
  groups: SidebarGroup[];
  brandBadge?: string;
  footerItem?: SidebarItem;
  headerExtras?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  async function handleSignOut() {
    await signOutAction();
  }

  const sidebarContent = (isMobile: boolean) => (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-white/5 px-4",
          collapsed && !isMobile ? "justify-center px-0" : "justify-between"
        )}
      >
        <Logo />
        {brandBadge && !(collapsed && !isMobile) ? (
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/80">
            {brandBadge}
          </span>
        ) : null}
      </div>

      <nav
        className={cn(
          "flex-1 space-y-4 overflow-y-auto py-4",
          collapsed && !isMobile ? "px-2" : "px-3"
        )}
        aria-label="Main navigation"
      >
        {groups.map((group, idx) => (
          <div key={group.label ?? idx} className="space-y-1">
            {group.label && !(collapsed && !isMobile) ? (
              <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted/80">
                {group.label}
              </p>
            ) : null}
            {group.items.map((item) => (
              <SidebarLink
                key={item.href}
                item={item}
                pathname={pathname}
                collapsed={collapsed && !isMobile}
                onNavigate={isMobile ? () => setMobileOpen(false) : undefined}
              />
            ))}
          </div>
        ))}
      </nav>

      <div
        className={cn(
          "shrink-0 space-y-2 border-t border-white/5 py-3",
          collapsed && !isMobile ? "px-2" : "px-3"
        )}
      >
        {footerItem ? (
          <SidebarLink
            item={footerItem}
            pathname={pathname}
            collapsed={collapsed && !isMobile}
            onNavigate={isMobile ? () => setMobileOpen(false) : undefined}
          />
        ) : null}
        {!(collapsed && !isMobile) ? (
          <button
            type="button"
            onClick={() => router.push("/settings")}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/5"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={profile.avatar_url ?? undefined} alt="" />
              <AvatarFallback className="bg-white/10 text-xs text-white">
                {getInitials(profile.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {profile.full_name || "User"}
              </p>
              <p className="truncate text-xs text-sidebar-muted">{profile.email}</p>
            </div>
          </button>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-white/5 bg-sidebar transition-[width] duration-300 ease-out-quint lg:block",
          collapsed ? "w-[76px]" : "w-64"
        )}
      >
        {sidebarContent(false)}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground"
        >
          <ChevronLeft
            className={cn(
              "h-3.5 w-3.5 transition-transform duration-300",
              collapsed && "rotate-180"
            )}
          />
        </button>
      </aside>

      {/* Main column */}
      <div
        className={cn(
          "flex min-h-screen flex-col transition-[padding] duration-300 ease-out-quint",
          collapsed ? "lg:pl-[76px]" : "lg:pl-64"
        )}
      >
        <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="w-72 border-r-0 bg-sidebar p-0 text-sidebar-foreground"
                >
                  <SheetTitle className="sr-only">Navigation</SheetTitle>
                  {sidebarContent(true)}
                </SheetContent>
              </Sheet>
              <div className="hidden items-center gap-2 sm:flex">
                <Badge variant="subtle" className="hidden font-semibold md:inline-flex">
                  {profile.currency === "BDT" ? "BDT" : profile.currency}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5">
              {headerExtras}
              <div className="hidden items-center gap-1.5 sm:flex">
                <Badge variant="info" className="font-semibold tabular-nums">
                  {profile.currency === "BDT" ? "৳" : "$"}
                  {Number(profile.balance ?? 0).toLocaleString("en-US", {
                    maximumFractionDigits: 2,
                  })}
                </Badge>
                <Badge
                  variant="secondary"
                  className="hidden font-semibold tabular-nums md:inline-flex"
                >
                  {Number(profile.coin_balance ?? 0).toLocaleString("en-US")} Coins
                </Badge>
              </div>
              <ThemeToggle />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="ml-0.5 flex items-center gap-2 rounded-full outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label="Account menu"
                  >
                    <Avatar className="h-9 w-9 ring-2 ring-border">
                      <AvatarImage
                        src={profile.avatar_url ?? undefined}
                        alt={profile.full_name ?? ""}
                      />
                      <AvatarFallback className="text-xs">
                        {getInitials(profile.full_name)}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel>
                    <p className="truncate text-sm font-semibold">
                      {profile.full_name || "User"}
                    </p>
                    <p className="truncate text-xs font-normal text-muted-foreground">
                      {profile.email}
                    </p>
                  </DropdownMenuLabel>
                  <div className="px-2 pb-2 sm:hidden">
                    <Badge variant="info" className="w-full justify-center font-semibold">
                      Balance: {profile.currency === "BDT" ? "৳" : "$"}
                      {Number(profile.balance ?? 0).toLocaleString("en-US", {
                        maximumFractionDigits: 2,
                      })}
                    </Badge>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/settings")}>
                    <Settings /> Profile Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6">
          <div className="mx-auto w-full max-w-7xl animate-fade-in">{children}</div>
        </main>

        <footer className="border-t px-4 py-4 text-center text-xs text-muted-foreground sm:px-6">
          <Link href="/" className="font-medium transition-colors hover:text-foreground">
            BD Cheap SMM
          </Link>{" "}
          · Premium SMM panel
        </footer>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Layers,
  ShoppingCart,
  ArrowDownToLine,
  Headphones,
  Settings,
  Bell,
  History,
  LogOut,
  Menu,
  Shield,
  Users,
  Megaphone,
  Target,
  Gift,
  Lightbulb,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { NotificationsButton } from "@/components/layout/notifications-button";
import { signOutAction } from "@/lib/actions/auth";
import { getInitials } from "@/lib/utils";
import type { Profile } from "@/lib/types/database";

const userNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/services", label: "Services", icon: Layers },
  { href: "/orders", label: "My Orders", icon: ShoppingCart },
  { href: "/notices", label: "Notice Board", icon: Megaphone },
  { href: "/goals", label: "Order Goals", icon: Target },
  { href: "/rewards", label: "Daily Reward", icon: Gift },
  { href: "/advisor", label: "Service Advisor", icon: Lightbulb },
  { href: "/add-funds", label: "Add Funds", icon: ArrowDownToLine },
  { href: "/transactions", label: "Transactions", icon: History },
  { href: "/referrals", label: "Referrals", icon: Users },
  { href: "/support", label: "Support", icon: Headphones },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({
  profile,
  siteName,
  unreadNotices = 0,
  children,
}: {
  profile: Profile;
  siteName: string;
  unreadNotices?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
    return (
      <nav className="flex flex-col gap-1">
        {userNav.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" &&
              item.href !== "/orders" &&
              item.href !== "/support" &&
              pathname.startsWith(item.href)) ||
            (item.href === "/orders" && pathname.startsWith("/orders")) ||
            (item.href === "/support" && pathname.startsWith("/support"));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {item.href === "/notices" && unreadNotices > 0 ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full gradient-bg px-1.5 text-[10px] font-bold text-white">
                  {unreadNotices > 9 ? "9+" : unreadNotices}
                </span>
              ) : null}
            </Link>
          );
        })}
        {profile.role === "admin" && profile.status === "active" ? (
          <Link
            href="/admin"
            onClick={onNavigate}
            className={cn(
              "mt-2 flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
            )}
          >
            <Shield className="h-4 w-4" />
            Admin Panel
          </Link>
        ) : null}
      </nav>
    );
  }

  async function handleSignOut() {
    await signOutAction();
  }

  return (
    <div className="min-h-screen">
      {/* Top header */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <div className="flex flex-col gap-6">
                  <Logo />
                  <NavLinks onNavigate={() => setMobileOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
            <Logo />
            <span className="hidden text-xs text-muted-foreground md:inline">|</span>
            <span className="hidden text-sm text-muted-foreground md:inline">
              {siteName}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Badge variant="info" className="hidden font-semibold sm:inline-flex">
              {profile.currency === "BDT" ? "৳" : "$"}
              {Number(profile.balance ?? 0).toLocaleString("en-US", {
                maximumFractionDigits: 2,
              })}
            </Badge>
            <Badge variant="secondary" className="hidden font-semibold sm:inline-flex">
              {Number(profile.coin_balance ?? 0).toLocaleString("en-US")} Coins
            </Badge>
            <NotificationsButton />
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 ring-2 ring-background">
                    <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.full_name ?? ""} />
                    <AvatarFallback>{getInitials(profile.full_name)}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="text-sm font-semibold">{profile.full_name || "User"}</p>
                  <p className="text-xs font-normal text-muted-foreground">{profile.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/settings")}>
                  <Settings /> Profile Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/notifications")}>
                  <Bell /> Notifications
                </DropdownMenuItem>
                <DropdownMenuSeparator />
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

      {/* Desktop sidebar + content */}
      <div className="container mx-auto flex gap-6 py-6">
        <aside className="sticky top-24 hidden h-fit w-56 shrink-0 lg:block">
          <div className="glass-card rounded-xl p-3">
            <NavLinks />
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

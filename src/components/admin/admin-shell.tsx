"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Layers,
  FolderTree,
  Server,
  Banknote,
  History,
  Headphones,
  TicketPercent,
  Megaphone,
  ScrollText,
  Settings,
  Key,
  LogOut,
  Shield,
  Menu,
  ArrowLeft,
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
import { signOutAction } from "@/lib/actions/auth";
import { getInitials } from "@/lib/utils";
import type { Profile } from "@/lib/types/database";

const adminNav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/services", label: "Services", icon: Layers },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/providers", label: "Providers", icon: Server },
  { href: "/admin/payments", label: "Payments", icon: Banknote },
  { href: "/admin/transactions", label: "Transactions", icon: History },
  { href: "/admin/support", label: "Support Tickets", icon: Headphones },
  { href: "/admin/coupons", label: "Coupons", icon: TicketPercent },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { href: "/admin/logs", label: "Audit Logs", icon: ScrollText },
  { href: "/admin/api-keys", label: "API Keys", icon: Key },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
    return (
      <nav className="flex flex-col gap-0.5">
        {adminNav.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
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
              {item.label}
            </Link>
          );
        })}
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="mt-2 flex items-center gap-3 rounded-lg border border-muted px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to User Panel
        </Link>
      </nav>
    );
  }

  async function handleSignOut() {
    await signOutAction();
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 overflow-y-auto">
                <SheetTitle className="sr-only">Admin navigation</SheetTitle>
                <div className="flex flex-col gap-6">
                  <div className="flex items-center gap-2">
                    <Logo />
                    <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                      <Shield className="h-3 w-3" /> Admin
                    </span>
                  </div>
                  <NavLinks onNavigate={() => setMobileOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
            <Logo />
            <span className="hidden items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary sm:inline-flex">
              <Shield className="h-3 w-3" /> Admin Panel
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.full_name ?? ""} />
                    <AvatarFallback>{getInitials(profile.full_name)}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="text-sm font-semibold">{profile.full_name || "Admin"}</p>
                  <p className="text-xs font-normal text-muted-foreground">{profile.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/dashboard")}>
                  <ArrowLeft /> User Panel
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

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

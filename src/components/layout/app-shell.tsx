"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import {
  LayoutDashboard,
  Wallet,
  Layers,
  ShoppingCart,
  ArrowDownToLine,
  Headphones,
  Settings,
  History,
  Shield,
  Users,
  Megaphone,
  Target,
  Gift,
  Lightbulb,
  CircleHelp,
} from "lucide-react";
import { LanguageSwitch, useCustomerText } from "@/components/customer-language";
import { NotificationsButton } from "@/components/layout/notifications-button";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import type { Profile } from "@/lib/types/database";

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
  const t = useCustomerText();
  const path = usePathname();
  const isAdmin = profile.role === "admin" && profile.status === "active";

  const groups = [
    {
      label: "Overview",
      items: [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
        { href: "/services", label: "Services", icon: Layers },
        { href: "/orders", label: "My Orders", icon: ShoppingCart },
      ],
    },
    {
      label: "Grow",
      items: [
        { href: "/notices", label: "Notice Board", icon: Megaphone, badge: unreadNotices },
        { href: "/goals", label: "Order Goals", icon: Target },
        { href: "/rewards", label: "Daily Reward", icon: Gift },
        { href: "/advisor", label: "Service Advisor", icon: Lightbulb },
        { href: "/referrals", label: "Referrals", icon: Users },
      ],
    },
    {
      label: "Wallet",
      items: [
        { href: "/add-funds", label: "Add Funds", icon: ArrowDownToLine },
        { href: "/transactions", label: "Transactions", icon: History },
      ],
    },
    {
      label: "Help",
      items: [
        { href: "/help-center", label: "Help Center", icon: CircleHelp },
        { href: "/support", label: "Support", icon: Headphones },
        { href: "/settings", label: "Settings", icon: Settings },
      ],
    },
  ];

  return (
    <>
    <DashboardShell
      profile={profile}
      groups={groups.map(group => ({ label: t(group.label), items: group.items.map(item => ({ ...item, label: t(item.label) })) }))}
      headerExtras={<><LanguageSwitch /><NotificationsButton /></>}
      footerItem={
        isAdmin
          ? { href: "/admin", label: t("Admin Panel"), icon: Shield }
          : undefined
      }
    >
      <div className="pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">{children}</div>
    </DashboardShell>
    <nav aria-label={t("Main navigation")} className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="grid h-16 grid-cols-4">
        {[
          { href: "/dashboard", label: "Home", icon: LayoutDashboard },
          { href: "/services", label: "Services", icon: Layers },
          { href: "/orders", label: "Orders", icon: ShoppingCart },
          { href: "/transactions", label: "Wallet", icon: Wallet },
        ].map(({href, label, icon: Icon}) => {
          const active = path === href || path.startsWith(href + "/") || (href === "/transactions" && path === "/add-funds");
          return <Link key={href} prefetch={false} href={href} aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center justify-center gap-1 text-xs font-medium ${active ? "bg-primary/5 text-primary" : "text-muted-foreground"}`}>
            <Icon className="h-5 w-5" />{t(label)}
          </Link>;
        })}
      </div>
    </nav>
    </>
  );
}

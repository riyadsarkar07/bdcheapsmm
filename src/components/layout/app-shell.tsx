"use client";

import * as React from "react";
import {
  LayoutDashboard,
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
    <DashboardShell
      profile={profile}
      groups={groups}
      headerExtras={<NotificationsButton />}
      footerItem={
        isAdmin
          ? { href: "/admin", label: "Admin Panel", icon: Shield }
          : undefined
      }
    >
      {children}
    </DashboardShell>
  );
}

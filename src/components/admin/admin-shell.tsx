"use client";

import * as React from "react";
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
  ClipboardList,
  ScrollText,
  Settings,
  Key,
  ArrowLeft,
  TrendingUp,
  Gift,
  Activity,
  CircleHelp,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import type { Profile } from "@/lib/types/database";

export function AdminShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  const groups = [
    {
      label: "Overview",
      items: [
        { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
        { href: "/admin/users", label: "Users", icon: Users },
        { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
      ],
    },
    {
      label: "Catalog",
      items: [
        { href: "/admin/services", label: "Services", icon: Layers },
        { href: "/admin/pricing", label: "Pricing & Profit", icon: TrendingUp },
        { href: "/admin/categories", label: "Categories", icon: FolderTree },
        { href: "/admin/providers", label: "Providers", icon: Server },
        { href: "/admin/provider-health", label: "Provider Health", icon: Activity },
      ],
    },
    {
      label: "Finance",
      items: [
        { href: "/admin/payments", label: "Payments", icon: Banknote },
        { href: "/admin/transactions", label: "Transactions", icon: History },
        { href: "/admin/referrals", label: "Referrals", icon: Gift },
        { href: "/admin/coupons", label: "Coupons", icon: TicketPercent },
      ],
    },
    {
      label: "Engagement",
      items: [
        { href: "/admin/support", label: "Support Tickets", icon: Headphones },
        { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
        { href: "/admin/notices", label: "Notice Board", icon: ClipboardList },
        { href: "/admin/help-center", label: "Help Center", icon: CircleHelp },
      ],
    },
    {
      label: "System",
      items: [
        { href: "/admin/logs", label: "Audit Logs", icon: ScrollText },
        { href: "/admin/api-keys", label: "API Keys", icon: Key },
        { href: "/admin/settings", label: "Settings", icon: Settings },
      ],
    },
  ];

  return (
    <DashboardShell
      profile={profile}
      groups={groups}
      brandBadge="Admin"
      footerItem={{ href: "/dashboard", label: "User Panel", icon: ArrowLeft }}
    >
      {children}
    </DashboardShell>
  );
}

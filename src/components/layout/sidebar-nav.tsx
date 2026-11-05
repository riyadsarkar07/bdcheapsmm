"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type SidebarItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  exact?: boolean;
};

export type SidebarGroup = {
  label?: string;
  items: SidebarItem[];
};

export function isItemActive(pathname: string, item: SidebarItem): boolean {
  if (item.exact) return pathname === item.href;
  if (item.href === "/admin" || item.href === "/dashboard") {
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function SidebarLink({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: SidebarItem;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const active = isItemActive(pathname, item);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-accent/60",
        active
          ? "bg-sidebar-accent/15 text-white"
          : "text-sidebar-foreground/70 hover:bg-white/5 hover:text-white",
        collapsed && "justify-center px-0"
      )}
    >
      {active ? (
        <span
          className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-sidebar-accent"
          aria-hidden
        />
      ) : null}
      <Icon
        className={cn(
          "h-[18px] w-[18px] shrink-0 transition-colors",
          active ? "text-sidebar-accent" : "text-sidebar-muted group-hover:text-white"
        )}
      />
      {collapsed ? null : <span className="flex-1 truncate">{item.label}</span>}
      {!collapsed && item.badge && item.badge > 0 ? (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-sidebar-accent px-1.5 text-[10px] font-bold text-white">
          {item.badge > 9 ? "9+" : item.badge}
        </span>
      ) : null}
      {collapsed && item.badge && item.badge > 0 ? (
        <span
          className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-sidebar-accent"
          aria-hidden
        />
      ) : null}
    </Link>
  );
}

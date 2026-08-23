"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn, timeAgo } from "@/lib/utils";
import {
  Bell,
  CheckCheck,
  Loader2,
  CreditCard,
  XCircle,
  CheckCircle2,
  Ticket,
  Megaphone,
  PackageCheck,
  PackageX,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { updateNotificationsReadAction, markAllNotificationsReadAction } from "@/lib/actions/profile";
import type { Notification, NotificationType } from "@/lib/types/database";

const typeIcon: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  payment_approved: CheckCircle2,
  payment_rejected: XCircle,
  order_completed: PackageCheck,
  order_cancelled: PackageX,
  system_announcement: Megaphone,
  ticket_reply: Ticket,
  order_status: RefreshCw,
};

export function NotificationsButton() {
  const router = useRouter();
  const supabase = createClient();
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [unread, setUnread] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (!mounted) return;
      setNotifications(data ?? []);
      setUnread((data ?? []).filter((n) => !n.is_read).length);
      setLoading(false);

      channel = supabase
        .channel("notifications-realtime")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const notif = payload.new as Notification;
            setNotifications((prev) => [notif, ...prev].slice(0, 20));
            setUnread((prev) => prev + 1);
          }
        )
        .subscribe();
    }

    void init();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase]);

  async function markAllRead() {
    await markAllNotificationsReadAction();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
  }

  async function openNotification(notif: Notification) {
    setOpen(false);
    if (!notif.is_read) {
      await updateNotificationsReadAction([notif.id]);
      setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)));
      setUnread((prev) => Math.max(prev - 1, 0));
    }
    router.push(notif.link ?? "/notifications");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full gradient-bg px-1 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b p-3">
          <p className="text-sm font-semibold">Notifications</p>
          <div className="flex items-center gap-2">
            {unread > 0 ? (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            ) : null}
            <Link href="/notifications" onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:underline">
              View all
            </Link>
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Bell className="mx-auto mb-2 h-6 w-6" />
              No notifications yet.
            </div>
          ) : (
            notifications.map((notif) => {
              const Icon = typeIcon[notif.type] ?? Megaphone;
              return (
                <button
                  key={notif.id}
                  onClick={() => openNotification(notif)}
                  className={cn(
                    "flex w-full items-start gap-3 border-b p-3 text-left transition-colors hover:bg-muted/50",
                    !notif.is_read && "bg-primary/5"
                  )}
                >
                  <div className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    !notif.is_read ? "gradient-bg text-white" : "bg-muted text-muted-foreground"
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{notif.title}</p>
                    {notif.body ? (
                      <p className="line-clamp-2 text-xs text-muted-foreground">{notif.body}</p>
                    ) : null}
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {timeAgo(notif.created_at)}
                    </p>
                  </div>
                  {!notif.is_read ? (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full gradient-bg" />
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

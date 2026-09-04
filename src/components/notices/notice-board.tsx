"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Megaphone,
  Wrench,
  Sparkles,
  Gift,
  CheckCheck,
  Circle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { markNoticeReadAction, markAllNoticesReadAction } from "@/lib/actions/notices";
import { formatDateTime } from "@/lib/utils";
import type { Notice, NoticeCategory } from "@/lib/types/database";

const categoryMeta: Record<
  NoticeCategory,
  { label: string; icon: React.ComponentType<{ className?: string }>; variant: "info" | "warning" | "success" | "secondary" }
> = {
  announcement: { label: "Announcement", icon: Megaphone, variant: "info" },
  update: { label: "Update", icon: Sparkles, variant: "secondary" },
  maintenance: { label: "Maintenance", icon: Wrench, variant: "warning" },
  offer: { label: "Offer", icon: Gift, variant: "success" },
};

export type NoticeWithRead = Notice & { is_read: boolean };

export function NoticeBoard({ notices }: { notices: NoticeWithRead[] }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function markRead(id: string, already: boolean) {
    if (already) return;
    await markNoticeReadAction(id);
    router.refresh();
  }

  async function markAll() {
    setLoading(true);
    try {
      await markAllNoticesReadAction();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const unread = notices.filter((n) => !n.is_read).length;

  return (
    <div>
      {unread > 0 ? (
        <div className="mb-4 flex justify-end">
          <Button variant="outline" size="sm" onClick={markAll} disabled={loading}>
            <CheckCheck /> Mark all read
          </Button>
        </div>
      ) : null}

      {notices.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No notices yet"
          description="Admin announcements, maintenance updates and offers will appear here."
        />
      ) : (
        <div className="space-y-3">
          {notices.map((notice) => {
            const meta = categoryMeta[notice.category] ?? categoryMeta.announcement;
            const Icon = meta.icon;
            return (
              <button
                key={notice.id}
                type="button"
                onClick={() => markRead(notice.id, notice.is_read)}
                className={`glass-card w-full rounded-xl p-4 text-left transition-colors ${
                  notice.is_read ? "" : "border-primary/40 bg-primary/5"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      notice.is_read ? "bg-muted text-muted-foreground" : "gradient-bg text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{notice.title}</p>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                      {!notice.is_read ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                          <Circle className="h-2 w-2 fill-current" /> Unread
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Read</span>
                      )}
                    </div>
                    {notice.body ? (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{notice.body}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatDateTime(notice.published_at ?? notice.created_at, "MMM d, yyyy h:mm a")}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

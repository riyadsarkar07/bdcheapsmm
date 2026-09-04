"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/empty-state";
import {
  createNoticeAction,
  updateNoticeAction,
  deleteNoticeAction,
  toggleNoticePublishAction,
} from "@/lib/actions/admin";
import { noticeSchema } from "@/lib/validations";
import { formatDateTime } from "@/lib/utils";
import type { Notice, NoticeCategory } from "@/lib/types/database";

const categoryLabel: Record<NoticeCategory, string> = {
  announcement: "Announcement",
  update: "Update",
  maintenance: "Maintenance",
  offer: "Offer",
};

export function AdminNotices({ notices }: { notices: Notice[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<Notice | null>(null);
  const [creating, setCreating] = React.useState(false);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="gradient" size="sm" onClick={() => setCreating(true)}>
          <Plus /> New Notice
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {notices.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No notices yet" description="Create a notice for the user notice board." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Title</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Updated</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {notices.map((notice) => (
                    <tr key={notice.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="max-w-[280px] px-4 py-3">
                        <p className="line-clamp-1 font-medium">{notice.title}</p>
                        {notice.body ? (
                          <p className="line-clamp-1 text-xs text-muted-foreground">{notice.body}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">{categoryLabel[notice.category]}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={notice.is_published ? "success" : "subtle"}>
                          {notice.is_published ? "Published" : "Draft"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDateTime(notice.updated_at, "MMM d, h:mm a")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="iconSm"
                            onClick={async () => {
                              const result = await toggleNoticePublishAction(notice.id, !notice.is_published);
                              if (result.success) {
                                toast.success(result.message ?? "Updated");
                                router.refresh();
                              } else {
                                toast.error(result.error ?? "Failed");
                              }
                            }}
                            aria-label={notice.is_published ? "Unpublish" : "Publish"}
                          >
                            {notice.is_published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </Button>
                          <Button variant="ghost" size="iconSm" onClick={() => setEditing(notice)} aria-label="Edit notice">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="iconSm"
                            className="text-destructive hover:text-destructive"
                            onClick={async () => {
                              if (!confirm(`Delete notice "${notice.title}"?`)) return;
                              const result = await deleteNoticeAction(notice.id);
                              if (result.success) {
                                toast.success("Notice deleted");
                                router.refresh();
                              } else {
                                toast.error(result.error ?? "Failed");
                              }
                            }}
                            aria-label="Delete notice"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {creating || editing ? (
        <NoticeFormDialog notice={editing} onClose={() => { setEditing(null); setCreating(false); }} />
      ) : null}
    </div>
  );
}

function NoticeFormDialog({ notice, onClose }: { notice: Notice | null; onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const form = useForm<z.infer<typeof noticeSchema>>({
    resolver: zodResolver(noticeSchema),
    defaultValues: {
      title: notice?.title ?? "",
      body: notice?.body ?? "",
      category: notice?.category ?? "announcement",
      isPublished: notice?.is_published ?? true,
    },
  });

  async function onSubmit(values: z.infer<typeof noticeSchema>) {
    setLoading(true);
    try {
      const result = notice
        ? await updateNoticeAction(notice.id, values)
        : await createNoticeAction(values);
      if (result.success) {
        toast.success(result.message ?? "Saved");
        router.refresh();
        onClose();
      } else {
        toast.error(result.error ?? "Failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{notice ? "Edit Notice" : "New Notice"}</DialogTitle>
          <DialogDescription>
            Published notices appear on the user Notice Board with unread badges.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input {...form.register("title")} placeholder="Maintenance window tonight" />
            {form.formState.errors.title ? (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <select
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              {...form.register("category")}
            >
              <option value="announcement">Announcement</option>
              <option value="update">Update</option>
              <option value="maintenance">Maintenance</option>
              <option value="offer">Offer</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Body</Label>
            <Textarea rows={5} {...form.register("body")} placeholder="Details shown to users..." />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Publish now</p>
              <p className="text-xs text-muted-foreground">Unpublished notices stay as drafts.</p>
            </div>
            <Switch
              checked={form.watch("isPublished")}
              onCheckedChange={(v) => form.setValue("isPublished", v)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="gradient" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : null}
              {notice ? "Save changes" : "Create notice"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

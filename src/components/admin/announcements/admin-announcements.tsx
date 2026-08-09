"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Send, Megaphone, Users, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { sendAnnouncementAction } from "@/lib/actions/admin";
import { timeAgo } from "@/lib/utils";
import type { NotificationType } from "@/lib/types/database";

const announcementSchema = z.object({
  title: z.string().min(3, "Title is required").max(200),
  body: z.string().max(2000).optional().or(z.literal("")),
  link: z
    .string()
    .max(500)
    .optional()
    .or(z.literal(""))
    .refine((v) => v == null || v === "" || v.startsWith("/"), "Link must start with /"),
});

type AnnouncementRow = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
  profiles?: { full_name: string | null; email: string | null } | null;
};

export function AdminAnnouncements({
  recent,
  users,
}: {
  recent: AnnouncementRow[];
  users: { id: string; full_name: string | null; email: string | null }[];
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"all" | "user">("all");
  const [userId, setUserId] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const form = useForm<z.infer<typeof announcementSchema>>({
    resolver: zodResolver(announcementSchema),
    defaultValues: { title: "", body: "", link: "" },
  });

  async function onSubmit(values: z.infer<typeof announcementSchema>) {
    if (mode === "user" && !userId) {
      toast.error("Select a user");
      return;
    }
    setLoading(true);
    try {
      const result = await sendAnnouncementAction({
        title: values.title,
        body: values.body || undefined,
        link: values.link || undefined,
        toAll: mode === "all",
        userId: mode === "user" ? userId : undefined,
      });
      if (result.success) {
        toast.success(result.message ?? "Announcement sent");
        form.reset();
        setMode("all");
        setUserId("");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to send");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="h-4 w-4 text-primary" />
            New Announcement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs value={mode} onValueChange={(v) => setMode(v as "all" | "user")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="all" className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> All Users
                </TabsTrigger>
                <TabsTrigger value="user" className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" /> Single User
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {mode === "user" ? (
              <div className="space-y-2">
                <Label>Recipient</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                >
                  <option value="">Select a user...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name ?? "User"} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Title</Label>
              <Input {...form.register("title")} placeholder="Site maintenance tonight at 2 AM" />
            </div>

            <div className="space-y-2">
              <Label>Message (optional)</Label>
              <Textarea {...form.register("body")} rows={4} placeholder="We will be performing maintenance..." />
            </div>

            <div className="space-y-2">
              <Label>Link (optional)</Label>
              <Input {...form.register("link")} placeholder="/dashboard" />
              <p className="text-xs text-muted-foreground">Internal path users can tap through to (e.g. /services).</p>
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <Send />}
              Send Announcement
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="h-4 w-4 text-primary" />
            Sent Recently
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recent.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No announcements sent yet" />
            </div>
          ) : (
            <div className="max-h-[560px] divide-y overflow-y-auto">
              {recent.map((item) => (
                <div key={item.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{item.title}</p>
                      {item.body ? <p className="mt-1 text-sm text-muted-foreground">{item.body}</p> : null}
                      {item.link ? (
                        <Badge variant="subtle" className="mt-2">{item.link}</Badge>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(item.created_at)}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    To: {item.profiles ? (item.profiles.full_name ?? item.profiles.email) : "All users"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

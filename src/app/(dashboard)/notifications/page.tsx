import {saveAlerts} from "@/lib/actions/customer-tools";
import {CustomerText} from "@/components/customer-language";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/guards";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import { markAllNotificationsReadAction } from "@/lib/actions/profile";

export const revalidate = 0;

export default async function NotificationsPage() {
  const { user, error } = await requireUser();
  if (error || !user) return null;

  const supabase = await createClient();
  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const {data:prefs}=await supabase.from("customer_alert_preferences").select("inbox,email").eq("user_id",user.id).maybeSingle();
  const emailReady=!!(process.env.RESEND_API_KEY && process.env.NOTIFICATION_EMAIL_FROM);
  return (
    <div>
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description="Payment updates, order status changes and announcements."
        icon={<Bell />}
      >
        <form action={markAllNotificationsReadAction}>
          <Button type="submit" variant="outline" size="sm">
            <CheckCheck /> Mark all read
          </Button>
        </form>
      </PageHeader>

      <details className="glass-card mb-4 p-4"><summary><CustomerText value="Notification preferences"/></summary><form action={saveAlerts} className="space-y-2 py-2">
        {["orders","wallet","support","catalog"].map(topic=><fieldset className="flex gap-3 border-b" key={topic}><legend><CustomerText value={topic[0].toUpperCase()+topic.slice(1)}/></legend>
          <label><input type="checkbox" name="inbox" value={topic} defaultChecked={!prefs||prefs.inbox.includes(topic)}/> <CustomerText value="In panel"/></label>
          <label><input type="checkbox" name="email" value={topic} disabled={!emailReady} defaultChecked={prefs?.email.includes(topic)}/> Email</label></fieldset>)}
        {!emailReady&&<p><CustomerText value="Email delivery awaits sender setup"/></p>}<Button><CustomerText value="Save"/></Button></form></details>
      {(notifications ?? []).length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description="You're all caught up."
        />
      ) : (
        <div className="space-y-2.5">
          <details className="glass-card mb-4 p-4"><summary><CustomerText value="Notification preferences"/></summary><form action={saveAlerts} className="space-y-2 py-2">
        {["orders","wallet","support","catalog"].map(topic=><fieldset className="flex gap-3 border-b" key={topic}><legend><CustomerText value={topic[0].toUpperCase()+topic.slice(1)}/></legend>
          <label><input type="checkbox" name="inbox" value={topic} defaultChecked={!prefs||prefs.inbox.includes(topic)}/> <CustomerText value="In panel"/></label>
          <label><input type="checkbox" name="email" value={topic} disabled={!emailReady} defaultChecked={prefs?.email.includes(topic)}/> Email</label></fieldset>)}
        {!emailReady&&<p><CustomerText value="Email delivery awaits sender setup"/></p>}<Button><CustomerText value="Save"/></Button></form></details>
      {(notifications ?? []).map((notif) => {
            const content = (
              <div
                className={cn(
                  "glass-card flex items-start gap-3 p-4 transition-colors",
                  !notif.is_read && "border-primary/30 bg-primary/5"
                )}
              >
                <div
                  className={cn(
                    "mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full",
                    notif.is_read ? "bg-muted-foreground/30" : "gradient-bg"
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{notif.title}</p>
                    {!notif.is_read ? (
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                        New
                      </span>
                    ) : null}
                  </div>
                  {notif.body ? (
                    <p className="mt-0.5 text-sm text-muted-foreground">{notif.body}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {timeAgo(notif.created_at)}
                  </p>
                </div>
              </div>
            );
            return notif.link ? (
              <Link key={notif.id} href={notif.link} className="block">
                {content}
              </Link>
            ) : (
              <div key={notif.id}>{content}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

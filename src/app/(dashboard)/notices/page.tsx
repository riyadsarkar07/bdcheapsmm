import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/guards";
import { PageHeader } from "@/components/page-header";
import { NoticeBoard, type NoticeWithRead } from "@/components/notices/notice-board";

export const revalidate = 0;

export default async function NoticesPage() {
  const { user, error } = await requireUser();
  if (error || !user) return null;

  const supabase = await createClient();
  const [{ data: notices }, { data: reads }] = await Promise.all([
    supabase
      .from("notices")
      .select("*")
      .eq("is_published", true)
      .order("published_at", { ascending: false }),
    supabase.from("notice_reads").select("notice_id").eq("user_id", user.id),
  ]);

  const readIds = new Set((reads ?? []).map((r) => r.notice_id));
  const rows: NoticeWithRead[] = (notices ?? []).map((n) => ({
    ...n,
    is_read: readIds.has(n.id),
  }));

  return (
    <div>
      <PageHeader
        title="Notice Board"
        description="Admin announcements, updates, maintenance and important offers."
      />
      <NoticeBoard notices={rows} />
    </div>
  );
}

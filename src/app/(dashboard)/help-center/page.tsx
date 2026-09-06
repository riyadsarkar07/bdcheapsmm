import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/guards";
import { getPublicSettings, getSetting } from "@/lib/settings";
import { PageHeader } from "@/components/page-header";
import { HelpCenter } from "@/components/help/help-center";
import { buildHelpContext, mergeHelpArticles } from "@/lib/help-center";
import type { HelpArticleCategory } from "@/lib/types/database";
import type { ReferralSettings } from "@/lib/types/app";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HelpCenterPage() {
  const { user, error } = await requireUser();
  if (error || !user) return null;

  const supabase = await createClient();
  const [settings, referrals, articlesRes, feedbackRes] = await Promise.all([
    getPublicSettings(),
    getSetting<ReferralSettings>("referrals"),
    supabase
      .from("help_articles")
      .select(
        "id, slug, category, title, excerpt, body, sort_order, is_published, is_popular, helpful_yes, helpful_no"
      )
      .eq("is_published", true),
    supabase.from("help_article_feedback").select("article_id, helpful").eq("user_id", user.id),
  ]);

  const ctx = buildHelpContext({
    siteName: settings.site.name,
    payments: settings.payments,
    currency: user.currency || settings.general.currency,
    referrals,
  });

  const dbRows = (articlesRes.error ? [] : articlesRes.data ?? []).map((row) => ({
    ...row,
    category: row.category as HelpArticleCategory,
  }));

  const articles = mergeHelpArticles(dbRows, ctx, false);
  const votes: Record<string, boolean> = {};
  for (const row of feedbackRes.data ?? []) {
    votes[row.article_id] = row.helpful;
  }

  return (
    <div>
      <PageHeader
        title="Help Center"
        description={`Search A-Z guides for ${settings.site.name}. Articles use live payment methods and referral settings.`}
      />
      <HelpCenter articles={articles} votes={votes} />
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/guards";
import { PageHeader } from "@/components/page-header";
import { AdminHelpCenter } from "@/components/admin/help/admin-help-center";
import { getHelpCatalog } from "@/lib/help-center";
import type { HelpArticle } from "@/lib/types/database";

export const revalidate = 0;

export default async function AdminHelpCenterPage() {
  const { user, error } = await requireAdmin();
  if (error || !user) return null;

  const supabase = await createClient();
  const { data: articles, error: articlesError } = await supabase
    .from("help_articles")
    .select("*")
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true });

  return (
    <div>
      <PageHeader
        title="Help Center"
        description="Create, edit, publish and organize user documentation. Seed default A-Z articles if the table is empty."
      />
      <AdminHelpCenter
        articles={(articlesError ? [] : (articles as HelpArticle[] | null)) ?? []}
        catalogCount={getHelpCatalog().length}
        loadError={articlesError?.message ?? null}
      />
    </div>
  );
}

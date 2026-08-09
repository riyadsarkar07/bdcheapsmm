import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/guards";
import { PageHeader } from "@/components/page-header";
import { AdminCategories } from "@/components/admin/categories/admin-categories";

export const revalidate = 0;

export default async function AdminCategoriesPage() {
  const { user, error } = await requireAdmin();
  if (error || !user) return null;

  const supabase = await createClient();
  const [categoriesRes, countRes] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("services").select("category_id, id"),
  ]);

  const counts = (countRes.data ?? []).reduce<Record<string, number>>((acc, s) => {
    if (s.category_id) acc[s.category_id] = (acc[s.category_id] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Organize your services into categories."
      />
      <AdminCategories categories={categoriesRes.data ?? []} serviceCounts={counts} />
    </div>
  );
}

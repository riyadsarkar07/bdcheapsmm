"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Pencil, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/empty-state";
import { CategoryIcon } from "@/components/category-icon";
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
} from "@/lib/actions/admin";

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
};

const categoryFormSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  description: z.string().optional().or(z.literal("")),
  icon: z.string().optional().or(z.literal("")),
  sortOrder: z.coerce.number().int(),
  isActive: z.boolean(),
});

const iconOptions = [
  "Instagram", "Facebook", "Youtube", "Music2", "Twitter", "Send",
  "MessageCircle", "Headphones", "Sparkles", "Tiktok", "Linkedin", "Snapchat",
];

export function AdminCategories({
  categories,
  serviceCounts,
}: {
  categories: CategoryRow[];
  serviceCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<CategoryRow | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="gradient" size="sm" onClick={() => setCreating(true)}>
          <Plus /> Add Category
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {categories.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No categories yet" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Slug</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Services</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Order</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Active</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <tr key={category.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-bg text-white">
                            <CategoryIcon icon={category.icon} className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium">{category.name}</p>
                            {category.description ? (
                              <p className="line-clamp-1 text-xs text-muted-foreground">{category.description}</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{category.slug}</td>
                      <td className="px-4 py-3 text-right">
                        <Badge variant="subtle">{serviceCounts[category.id] ?? 0}</Badge>
                      </td>
                      <td className="px-4 py-3">{category.sort_order}</td>
                      <td className="px-4 py-3">
                        <Badge variant={category.is_active ? "success" : "destructive"}>{category.is_active ? "Active" : "Hidden"}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="iconSm" onClick={() => setEditing(category)} aria-label="Edit category">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="iconSm"
                            className="text-destructive hover:text-destructive"
                            onClick={async () => {
                              if (!confirm(`Delete category "${category.name}"? Services will lose their category.`)) return;
                              setLoading(true);
                              try {
                                const result = await deleteCategoryAction(category.id);
                                if (result.success) {
                                  toast.success("Category deleted");
                                  router.refresh();
                                } else {
                                  toast.error(result.error ?? "Failed");
                                }
                              } finally {
                                setLoading(false);
                              }
                            }}
                            aria-label="Delete category"
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

      {(creating || editing) ? (
        <CategoryFormDialog
          category={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      ) : null}
    </div>
  );
}

function CategoryFormDialog({
  category,
  onClose,
}: {
  category: CategoryRow | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  const form = useForm<z.infer<typeof categoryFormSchema>>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: category?.name ?? "",
      slug: category?.slug ?? "",
      description: category?.description ?? "",
      icon: category?.icon ?? "",
      sortOrder: category?.sort_order ?? 0,
      isActive: category?.is_active ?? true,
    },
  });

  async function onSubmit(values: z.infer<typeof categoryFormSchema>) {
    setLoading(true);
    try {
      const result = category
        ? await updateCategoryAction(category.id, values)
        : await createCategoryAction(values);
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
          <DialogTitle>{category ? "Edit Category" : "Add Category"}</DialogTitle>
          <DialogDescription>
            Categories group your services on the storefront.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input {...form.register("name")} />
          </div>
          <div className="space-y-2">
            <Label>Slug</Label>
            <Input {...form.register("slug")} placeholder="instagram" />
          </div>
          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-2">
              {iconOptions.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => form.setValue("icon", icon)}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${
                    form.watch("icon") === icon ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"
                  }`}
                  aria-label={icon}
                >
                  <CategoryIcon icon={icon} className="h-5 w-5" />
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input {...form.register("description")} />
          </div>
          <div className="space-y-2">
            <Label>Sort Order</Label>
            <Input type="number" {...form.register("sortOrder")} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={form.watch("isActive")} onCheckedChange={(v) => form.setValue("isActive", v)} />
            Active
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <Pencil />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  createHelpArticleAction,
  deleteHelpArticleAction,
  seedHelpCatalogAction,
  toggleHelpArticlePublishAction,
  updateHelpArticleAction,
} from "@/lib/actions/admin";
import { HELP_CATEGORY_META } from "@/lib/help-center";
import { helpArticleSchema } from "@/lib/validations";
import { formatDateTime, slugify } from "@/lib/utils";
import type { HelpArticle, HelpArticleCategory } from "@/lib/types/database";

type FormValues = z.infer<typeof helpArticleSchema>;

export function AdminHelpCenter({
  articles,
  catalogCount,
  loadError,
}: {
  articles: HelpArticle[];
  catalogCount: number;
  loadError: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<HelpArticle | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [seeding, setSeeding] = React.useState(false);

  async function seed() {
    setSeeding(true);
    try {
      const result = await seedHelpCatalogAction();
      if (result.success) {
        toast.success(result.message ?? "Seeded");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to seed articles");
      }
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="sm" onClick={seed} disabled={seeding}>
          {seeding ? <Loader2 className="animate-spin" /> : <Sparkles />}
          Seed {catalogCount} default articles
        </Button>
        <Button variant="gradient" size="sm" onClick={() => setCreating(true)}>
          <Plus /> New article
        </Button>
      </div>

      {loadError ? (
        <p className="mb-4 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          Could not load database articles ({loadError}). Apply migration 0017_help_center.sql, then seed defaults.
        </p>
      ) : null}

      <Card>
        <CardContent className="p-0">
          {articles.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No database articles yet"
                description="Users still see built-in A-Z guides. Seed defaults or create an article to manage them here."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Title</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Order</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Updated</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {articles.map((article) => (
                    <tr key={article.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="max-w-[280px] px-4 py-3">
                        <p className="line-clamp-1 font-medium">{article.title}</p>
                        <p className="line-clamp-1 text-xs text-muted-foreground">{article.slug}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">
                          {HELP_CATEGORY_META[article.category as HelpArticleCategory]?.label ?? article.category}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">{article.sort_order}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant={article.is_published ? "success" : "subtle"}>
                            {article.is_published ? "Published" : "Draft"}
                          </Badge>
                          {article.is_popular ? <Badge variant="info">Popular</Badge> : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDateTime(article.updated_at, "MMM d, h:mm a")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="iconSm"
                            onClick={async () => {
                              const result = await toggleHelpArticlePublishAction(article.id, !article.is_published);
                              if (result.success) {
                                toast.success(result.message ?? "Updated");
                                router.refresh();
                              } else {
                                toast.error(result.error ?? "Failed");
                              }
                            }}
                            aria-label={article.is_published ? "Unpublish" : "Publish"}
                          >
                            {article.is_published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </Button>
                          <Button variant="ghost" size="iconSm" onClick={() => setEditing(article)} aria-label="Edit article">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="iconSm"
                            className="text-destructive hover:text-destructive"
                            onClick={async () => {
                              if (!confirm(`Delete article "${article.title}"?`)) return;
                              const result = await deleteHelpArticleAction(article.id);
                              if (result.success) {
                                toast.success("Article deleted");
                                router.refresh();
                              } else {
                                toast.error(result.error ?? "Failed");
                              }
                            }}
                            aria-label="Delete article"
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
        <ArticleFormDialog
          article={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      ) : null}
    </div>
  );
}

function ArticleFormDialog({ article, onClose }: { article: HelpArticle | null; onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(helpArticleSchema),
    defaultValues: {
      title: article?.title ?? "",
      slug: article?.slug ?? "",
      category: (article?.category as FormValues["category"]) ?? "getting-started",
      excerpt: article?.excerpt ?? "",
      body: article?.body ?? "",
      sortOrder: article?.sort_order ?? 10,
      isPublished: article?.is_published ?? true,
      isPopular: article?.is_popular ?? false,
    },
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const result = article
        ? await updateHelpArticleAction(article.id, values)
        : await createHelpArticleAction(values);
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{article ? "Edit article" : "New article"}</DialogTitle>
          <DialogDescription>
            Published articles appear in the user Help Center. Placeholders like {"{{siteName}}"} are filled from live settings.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              {...form.register("title")}
              placeholder="How to place an order"
              onBlur={(event) => {
                if (!article && !form.getValues("slug")) {
                  form.setValue("slug", slugify(event.target.value));
                }
              }}
            />
            {form.formState.errors.title ? (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input {...form.register("slug")} placeholder="how-to-place-an-order" />
              {form.formState.errors.slug ? (
                <p className="text-xs text-destructive">{form.formState.errors.slug.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Sort order</Label>
              <Input type="number" min={0} {...form.register("sortOrder")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <select
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              {...form.register("category")}
            >
              {Object.entries(HELP_CATEGORY_META).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.letter}. {meta.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Excerpt</Label>
            <Input {...form.register("excerpt")} placeholder="Short summary shown in lists" />
          </div>
          <div className="space-y-2">
            <Label>Body</Label>
            <Textarea rows={10} {...form.register("body")} placeholder="Full article..." />
            {form.formState.errors.body ? (
              <p className="text-xs text-destructive">{form.formState.errors.body.message}</p>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Published</p>
                <p className="text-xs text-muted-foreground">Visible in the user Help Center</p>
              </div>
              <Switch
                checked={form.watch("isPublished")}
                onCheckedChange={(value) => form.setValue("isPublished", value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Popular</p>
                <p className="text-xs text-muted-foreground">Show in Popular articles</p>
              </div>
              <Switch
                checked={form.watch("isPopular")}
                onCheckedChange={(value) => form.setValue("isPopular", value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="gradient" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : null}
              {article ? "Save changes" : "Create article"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

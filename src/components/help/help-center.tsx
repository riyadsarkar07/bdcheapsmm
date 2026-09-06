"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  BookOpen,
  CircleHelp,
  Headphones,
  Search,
  Star,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { submitHelpFeedbackAction } from "@/lib/actions/help";
import { HELP_CATEGORY_META, type HelpArticleView } from "@/lib/help-center";
import type { HelpArticleCategory } from "@/lib/types/database";
import { cn } from "@/lib/utils";

const CATEGORY_ORDER = Object.keys(HELP_CATEGORY_META) as HelpArticleCategory[];

function matchesQuery(article: HelpArticleView, query: string): boolean {
  if (!query) return true;
  const haystack = [
    article.title,
    article.excerpt,
    article.body,
    HELP_CATEGORY_META[article.category]?.label ?? "",
    article.slug,
  ]
    .join(" ")
    .toLowerCase();
  return query.split(/\s+/).every((token) => haystack.includes(token));
}

export function HelpCenter({
  articles,
  votes,
}: {
  articles: HelpArticleView[];
  votes: Record<string, boolean>;
}) {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<HelpArticleCategory | "all">("all");
  const [openSlug, setOpenSlug] = React.useState<string>("");
  const [localVotes, setLocalVotes] = React.useState(votes);
  const search = query.trim().toLowerCase();

  const filtered = articles.filter((article) => {
    if (category !== "all" && article.category !== category) return false;
    return matchesQuery(article, search);
  });

  const popular = articles.filter((article) => article.isPopular).slice(0, 8);
  const grouped = CATEGORY_ORDER.map((key) => ({
    key,
    meta: HELP_CATEGORY_META[key],
    items: filtered.filter((article) => article.category === key),
  })).filter((group) => group.items.length > 0);

  function jumpTo(slug: string, nextCategory?: HelpArticleCategory) {
    if (nextCategory) setCategory(nextCategory);
    setOpenSlug(slug);
    window.requestAnimationFrame(() => {
      document.getElementById(`help-${slug}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function vote(article: HelpArticleView, helpful: boolean) {
    if (!article.id) {
      setLocalVotes((prev) => ({ ...prev, [article.slug]: helpful }));
      toast.success("Thanks for the feedback.");
      return;
    }
    const result = await submitHelpFeedbackAction({ articleId: article.id, helpful });
    if (result.success) {
      setLocalVotes((prev) => ({ ...prev, [article.id as string]: helpful }));
      toast.success(result.message ?? "Thanks for the feedback.");
    } else {
      toast.error(result.error ?? "Could not save feedback");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search articles, order status, payments, coins..."
              className="pl-9"
              aria-label="Search help articles"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={category === "all" ? "gradient" : "outline"}
              onClick={() => setCategory("all")}
            >
              All
            </Button>
            {CATEGORY_ORDER.map((key) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={category === key ? "default" : "outline"}
                onClick={() => setCategory(key)}
              >
                {HELP_CATEGORY_META[key].letter}. {HELP_CATEGORY_META[key].label}
              </Button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {filtered.length} article{filtered.length === 1 ? "" : "s"} · A-Z categories · Instant search
            </p>
            <Button asChild variant="gradient" size="sm">
              <Link href="/support/new">
                <Headphones /> Contact Support
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {popular.length > 0 && !search && category === "all" ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="h-4 w-4 text-warning" /> Popular articles
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {popular.map((article) => (
              <button
                key={article.slug}
                type="button"
                onClick={() => jumpTo(article.slug, article.category)}
                className="rounded-lg border p-3 text-left hover:bg-muted/50"
              >
                <p className="text-sm font-medium">{article.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{article.excerpt}</p>
              </button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {grouped.length === 0 ? (
        <EmptyState
          icon={CircleHelp}
          title="No matching articles"
          description="Try another search, or open a support ticket if you still need help."
          action={
            <Button asChild variant="gradient">
              <Link href="/support/new">Contact Support</Link>
            </Button>
          }
        />
      ) : (
        grouped.map((group) => (
          <Card key={group.key} id={`help-cat-${group.key}`}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-4 w-4 text-primary" />
                {group.meta.letter}. {group.meta.label}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{group.meta.description}</p>
            </CardHeader>
            <CardContent>
              <Accordion
                type="single"
                collapsible
                value={group.items.some((item) => item.slug === openSlug) ? openSlug : undefined}
                onValueChange={setOpenSlug}
              >
                {group.items.map((article) => {
                  const voteKey = article.id ?? article.slug;
                  const currentVote = localVotes[voteKey];
                  return (
                    <AccordionItem key={article.slug} value={article.slug} id={`help-${article.slug}`}>
                      <AccordionTrigger className="text-left">
                        <span className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
                          <span>{article.title}</span>
                          {article.isPopular ? <Badge variant="info">Popular</Badge> : null}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        {article.excerpt ? (
                          <p className="mb-3 text-sm font-medium text-muted-foreground">{article.excerpt}</p>
                        ) : null}
                        <div className="space-y-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
                          {article.body}
                        </div>
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                          <p className="text-xs text-muted-foreground">Was this helpful?</p>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={currentVote === true ? "success" : "outline"}
                              className={cn(currentVote === true && "text-white")}
                              onClick={() => vote(article, true)}
                            >
                              <ThumbsUp /> Yes
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={currentVote === false ? "destructive" : "outline"}
                              onClick={() => vote(article, false)}
                            >
                              <ThumbsDown /> No
                            </Button>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

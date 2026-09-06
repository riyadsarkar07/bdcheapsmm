-- ============================================================
-- Help Center articles and per-user feedback
-- Additive + idempotent. Does not alter existing feature tables.
-- ============================================================

create table if not exists public.help_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  category text not null,
  title text not null,
  excerpt text,
  body text not null,
  sort_order integer not null default 0,
  is_published boolean not null default false,
  is_popular boolean not null default false,
  helpful_yes integer not null default 0 check (helpful_yes >= 0),
  helpful_no integer not null default 0 check (helpful_no >= 0),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug),
  constraint help_articles_category_check check (
    category in (
      'getting-started',
      'ordering',
      'payments',
      'services',
      'orders-safety',
      'rewards',
      'referrals',
      'notices',
      'advisor',
      'security',
      'support',
      'troubleshooting'
    )
  )
);

create index if not exists idx_help_articles_published
  on public.help_articles (is_published, category, sort_order, title);

create index if not exists idx_help_articles_popular
  on public.help_articles (is_popular, sort_order)
  where is_published = true;

create table if not exists public.help_article_feedback (
  article_id uuid not null references public.help_articles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  helpful boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (article_id, user_id)
);

create index if not exists idx_help_article_feedback_user
  on public.help_article_feedback (user_id);

drop trigger if exists set_updated_at on public.help_articles;
create trigger set_updated_at before update on public.help_articles
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.help_article_feedback;
create trigger set_updated_at before update on public.help_article_feedback
for each row execute function public.set_updated_at();

alter table public.help_articles enable row level security;
alter table public.help_article_feedback enable row level security;

drop policy if exists "help_articles_select_published" on public.help_articles;
create policy "help_articles_select_published" on public.help_articles
  for select using (is_published = true or public.is_admin());

drop policy if exists "help_articles_admin_insert" on public.help_articles;
create policy "help_articles_admin_insert" on public.help_articles
  for insert with check (public.is_admin());

drop policy if exists "help_articles_admin_update" on public.help_articles;
create policy "help_articles_admin_update" on public.help_articles
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "help_articles_admin_delete" on public.help_articles;
create policy "help_articles_admin_delete" on public.help_articles
  for delete using (public.is_admin());

drop policy if exists "help_feedback_select_own" on public.help_article_feedback;
create policy "help_feedback_select_own" on public.help_article_feedback
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "help_feedback_insert_own" on public.help_article_feedback;
create policy "help_feedback_insert_own" on public.help_article_feedback
  for insert with check (auth.uid() = user_id);

drop policy if exists "help_feedback_update_own" on public.help_article_feedback;
create policy "help_feedback_update_own" on public.help_article_feedback
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.sync_help_article_feedback_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.helpful then
      update public.help_articles
         set helpful_yes = helpful_yes + 1
       where id = new.article_id;
    else
      update public.help_articles
         set helpful_no = helpful_no + 1
       where id = new.article_id;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and old.helpful is distinct from new.helpful then
    if new.helpful then
      update public.help_articles
         set helpful_yes = helpful_yes + 1,
             helpful_no = greatest(helpful_no - 1, 0)
       where id = new.article_id;
    else
      update public.help_articles
         set helpful_no = helpful_no + 1,
             helpful_yes = greatest(helpful_yes - 1, 0)
       where id = new.article_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists help_feedback_counts on public.help_article_feedback;
create trigger help_feedback_counts
after insert or update on public.help_article_feedback
for each row execute function public.sync_help_article_feedback_counts();

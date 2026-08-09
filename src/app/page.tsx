import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPublicSettings } from "@/lib/settings";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { CategoryIcon } from "@/components/category-icon";
import {
  Zap,
  ShieldCheck,
  Rocket,
  Headphones,
  ArrowRight,
  TrendingUp,
  Wallet,
  Clock,
} from "lucide-react";

const features = [
  {
    icon: Rocket,
    title: "Instant Delivery",
    description: "Orders are submitted to providers instantly and start within minutes.",
  },
  {
    icon: ShieldCheck,
    title: "Secure & Safe",
    description: "Your account, balance and data are protected with the latest security.",
  },
  {
    icon: Wallet,
    title: "Easy Deposit",
    description: "Add funds via bKash, Nagad or Rocket. Simple manual approval process.",
  },
  {
    icon: Headphones,
    title: "24/7 Support",
    description: "Our support team is always ready to help you with any issue.",
  },
];

export default async function LandingPage() {
  const settings = await getPublicSettings();
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, slug, icon")
    .eq("is_active", true)
    .order("sort_order")
    .limit(8);

  const { data: services } = await supabase
    .from("services")
    .select("id, name, price, min_quantity, max_quantity, category_id, categories(name, slug)")
    .eq("is_active", true)
    .order("price", { ascending: true })
    .limit(8);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute -top-52 left-1/4 h-[500px] w-[500px] rounded-full bg-violet-600/25 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 right-0 h-[400px] w-[400px] rounded-full bg-fuchsia-500/20 blur-3xl" />

      <header className="relative z-20 border-b border-white/5">
        <div className="container mx-auto flex h-16 items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <Button asChild variant="gradient">
                <Link href="/dashboard">
                  Dashboard <ArrowRight />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" className="hidden sm:inline-flex">
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button asChild variant="gradient">
                  <Link href="/register">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section className="container mx-auto flex flex-col items-center px-4 pb-16 pt-20 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-background/60 px-4 py-1.5 text-xs font-medium backdrop-blur">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            The cheapest SMM panel in Bangladesh
          </div>
          <h1 className="max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            Grow your social media with{" "}
            <span className="gradient-text">BD Cheap SMM</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            {settings.site.tagline}. Real, fast and affordable followers, likes,
            views and more — across Instagram, Facebook, YouTube, TikTok and
            more.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" variant="gradient">
              <Link href={user ? "/services" : "/register"}>
                {user ? "Browse Services" : "Create Free Account"}
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/services">View Prices</Link>
            </Button>
          </div>

          <div className="mt-14 grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { icon: TrendingUp, label: "10K+ Orders", value: "Delivered" },
              { icon: Wallet, label: "Cheapest Rates", value: "In BD" },
              { icon: Zap, label: "Instant", value: "Auto Delivery" },
              { icon: Clock, label: "24/7", value: "Support" },
            ].map((item) => (
              <div
                key={item.label}
                className="glass-card flex flex-col items-center gap-2 rounded-xl p-4"
              >
                <item.icon className="h-5 w-5 text-primary" />
                <p className="text-sm font-semibold">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Categories */}
        <section className="container mx-auto px-4 py-12">
          <h2 className="mb-6 text-center text-2xl font-bold">Popular Categories</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {(categories ?? []).map((category) => (
              <Link
                key={category.id}
                href={`/services?category=${category.slug}`}
                className="glass-card group flex flex-col items-center gap-3 rounded-xl p-6 transition-all hover:-translate-y-0.5 hover:shadow-xl"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg gradient-bg text-white shadow-lg shadow-fuchsia-500/20">
                  <CategoryIcon icon={category.icon} className="h-6 w-6" />
                </div>
                <span className="text-sm font-semibold">{category.name}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Popular services */}
        <section className="container mx-auto px-4 py-12">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold">Starting from ৳1</h2>
            <Button asChild variant="link">
              <Link href="/services">
                View all services <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(services ?? []).map((service) => (
              <Link
                key={service.id}
                href={`/services?service=${service.id}`}
                className="glass-card group flex flex-col justify-between rounded-xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-xl"
              >
                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {service.categories?.name ?? "General"}
                  </p>
                  <p className="line-clamp-2 text-sm font-semibold">{service.name}</p>
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Starting at</p>
                    <p className="text-lg font-bold text-primary">
                      ৳{Number(service.price).toFixed(2)}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {service.min_quantity}-{service.max_quantity}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="container mx-auto px-4 py-12">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="glass-card rounded-xl p-6"
              >
                <feature.icon className="mb-3 h-6 w-6 text-primary" />
                <h3 className="mb-1 font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="container mx-auto px-4 py-16">
          <div className="glass-card relative overflow-hidden rounded-2xl p-8 text-center sm:p-12">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full gradient-bg opacity-20 blur-3xl" />
            <h2 className="relative text-2xl font-bold sm:text-3xl">
              Ready to boost your social presence?
            </h2>
            <p className="relative mx-auto mt-2 max-w-md text-muted-foreground">
              Create a free account and place your first order in under a minute.
            </p>
            <Button asChild size="lg" variant="gradient" className="relative mt-6">
              <Link href={user ? "/services" : "/register"}>
                {user ? "Browse Services" : "Create Free Account"}
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/5 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          {settings.footer.text.replace("{year}", String(new Date().getFullYear()))}
        </div>
      </footer>
    </div>
  );
}

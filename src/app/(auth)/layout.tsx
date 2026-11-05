import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { getPublicSettings } from "@/lib/settings";
import { ShieldCheck, Zap, Wallet, Headphones } from "lucide-react";

const highlights = [
  { icon: Zap, text: "Instant automated delivery" },
  { icon: Wallet, text: "Cheapest rates in Bangladesh" },
  { icon: ShieldCheck, text: "Secure wallet & data" },
  { icon: Headphones, text: "24/7 human support" },
];

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const settings = await getPublicSettings();

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.35]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />

      <header className="relative z-20">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-1">
            <Link
              href="/"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
            >
              Back to site
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <div className="grid w-full max-w-5xl items-center gap-10 lg:grid-cols-2">
          <div className="hidden lg:block">
            <p className="eyebrow mb-3">{settings.site.name}</p>
            <h2 className="text-3xl font-bold leading-tight tracking-tight">
              Grow your social presence with a panel built for{" "}
              <span className="gradient-text">real results.</span>
            </h2>
            <p className="mt-3 max-w-md text-sm text-muted-foreground">
              {settings.site.tagline}. Join thousands of creators and brands
              scaling their reach affordably.
            </p>
            <ul className="mt-8 space-y-3">
              {highlights.map((item) => (
                <li key={item.text} className="flex items-center gap-3 text-sm">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span className="text-muted-foreground">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass-card mx-auto w-full max-w-md rounded-2xl p-6 shadow-elevated sm:p-8">
            <div className="mb-6 flex justify-center lg:hidden">
              <Logo />
            </div>
            {children}
          </div>
        </div>
      </main>

      <footer className="relative z-10 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {settings.site.name}. All rights reserved.
      </footer>
    </div>
  );
}

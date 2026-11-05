import Link from "next/link";
import { Compass, Home, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="glass-card w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Compass className="h-7 w-7" />
        </div>
        <p className="eyebrow">Error 404</p>
        <h1 className="mt-1 text-xl font-bold">Page not found</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          The page you are looking for doesn&apos;t exist or may have been moved.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild variant="gradient">
            <Link href="/dashboard">
              <Home /> Dashboard
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/support">
              <LifeBuoy /> Support
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

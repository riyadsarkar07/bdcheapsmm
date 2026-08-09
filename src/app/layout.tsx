import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/components/query-provider";
import { getPublicSettings } from "@/lib/settings";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSettings();
  return {
    title: {
      default: settings.seo.title,
      template: `%s | ${settings.site.name}`,
    },
    description: settings.seo.description,
    keywords: settings.seo.keywords,
    icons: settings.site.favicon
      ? { icon: settings.site.favicon }
      : undefined,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#7c3aed",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getPublicSettings();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <QueryProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <noscript>
              <div
                style={{
                  padding: "1rem",
                  textAlign: "center",
                  background: "#fef2f2",
                  color: "#b91c1c",
                  fontFamily: "sans-serif",
                }}
              >
                Please enable JavaScript to use {settings.site.name}.
              </div>
            </noscript>
            {children}
            <Toaster position="top-right" richColors />
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}

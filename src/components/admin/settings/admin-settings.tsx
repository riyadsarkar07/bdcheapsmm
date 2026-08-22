"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Save, Globe, Banknote, Palette, ShieldAlert, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { adminSettingsSchema } from "@/lib/validations";
import { updateSettingsAction } from "@/lib/actions/admin";

type FormValues = z.infer<typeof adminSettingsSchema>;

export function AdminSettings({
  initial,
}: {
  initial: {
    site: { name: string; tagline: string; logo: string | null; favicon: string | null };
    general: { currency: string; timezone: string; maintenance_mode: boolean };
    payments: { bKash: string; nagad: string; rocket: string; enabled: string[] };
    seo: { title: string; description: string; keywords: string };
    footer: { text: string };
  };
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(adminSettingsSchema),
    defaultValues: {
      siteName: initial.site.name,
      tagline: initial.site.tagline ?? "",
      logo: initial.site.logo ?? "",
      favicon: initial.site.favicon ?? "",
      currency: initial.general.currency,
      timezone: initial.general.timezone,
      maintenanceMode: initial.general.maintenance_mode,
      bKash: initial.payments.bKash ?? "",
      nagad: initial.payments.nagad ?? "",
      rocket: initial.payments.rocket ?? "",
      bKashEnabled: (initial.payments.enabled ?? ["bKash", "nagad", "rocket"]).includes("bKash"),
      nagadEnabled: (initial.payments.enabled ?? ["bKash", "nagad", "rocket"]).includes("nagad"),
      rocketEnabled: (initial.payments.enabled ?? ["bKash", "nagad", "rocket"]).includes("rocket"),
      seoTitle: initial.seo.title ?? "",
      seoDescription: initial.seo.description ?? "",
      seoKeywords: initial.seo.keywords ?? "",
      footerText: initial.footer.text ?? "",
    },
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const result = await updateSettingsAction(values);
      if (result.success) {
        toast.success("Settings saved");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to save");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4 text-primary" /> Site Identity
          </CardTitle>
          <CardDescription>Shown on the landing page, browser tab and emails.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Site Name</Label>
            <Input {...form.register("siteName")} />
          </div>
          <div className="space-y-2">
            <Label>Tagline</Label>
            <Input {...form.register("tagline")} />
          </div>
          <div className="space-y-2">
            <Label>Logo URL</Label>
            <Input {...form.register("logo")} placeholder="https://.../logo.png" />
          </div>
          <div className="space-y-2">
            <Label>Favicon URL</Label>
            <Input {...form.register("favicon")} placeholder="https://.../favicon.ico" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Banknote className="h-4 w-4 text-primary" /> Payments & Numbers
          </CardTitle>
          <CardDescription>
            Mobile banking numbers shown on the add-funds page. Users send money to these numbers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>bKash</Label>
              <Input {...form.register("bKash")} placeholder="01XXXXXXXXX" />
            </div>
            <div className="space-y-2">
              <Label>Nagad</Label>
              <Input {...form.register("nagad")} placeholder="01XXXXXXXXX" />
            </div>
            <div className="space-y-2">
              <Label>Rocket</Label>
              <Input {...form.register("rocket")} placeholder="01XXXXXXXXX" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                { key: "bKash", label: "bKash" },
                { key: "nagad", label: "Nagad" },
                { key: "rocket", label: "Rocket" },
              ] as const
            ).map((m) => (
              <div
                key={m.key}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{m.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {form.watch(`${m.key}Enabled`) ? "Visible to users" : "Hidden from users"}
                  </p>
                </div>
                <Switch
                  checked={form.watch(`${m.key}Enabled`)}
                  onCheckedChange={(v) => form.setValue(`${m.key}Enabled`, v)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4 text-primary" /> General
          </CardTitle>
          <CardDescription>Global defaults for currency and timezone.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Currency</Label>
            <Input {...form.register("currency")} placeholder="BDT" />
          </div>
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Input {...form.register("timezone")} placeholder="Asia/Dhaka" />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
            <div className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Maintenance Mode</p>
                <p className="text-xs text-muted-foreground">
                  Shows a maintenance notice to regular users while admins can still access the panel.
                </p>
              </div>
            </div>
            <Switch checked={form.watch("maintenanceMode")} onCheckedChange={(v) => form.setValue("maintenanceMode", v)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4 text-primary" /> SEO
          </CardTitle>
          <CardDescription>Meta tags used for search engine and social sharing.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-2">
            <Label>Meta Title</Label>
            <Input {...form.register("seoTitle")} />
          </div>
          <div className="space-y-2">
            <Label>Meta Description</Label>
            <Textarea {...form.register("seoDescription")} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Keywords (comma separated)</Label>
            <Input {...form.register("seoKeywords")} />
          </div>
          <div className="space-y-2">
            <Label>Footer Text</Label>
            <Input {...form.register("footerText")} />
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex justify-end">
        <Button type="submit" variant="gradient" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : <Save />}
          Save Settings
        </Button>
      </div>
    </form>
  );
}

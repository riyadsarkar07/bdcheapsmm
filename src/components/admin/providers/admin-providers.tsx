"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Pencil, Trash2, Plus, RefreshCw, Wallet, Server, ShieldCheck, PlugZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import {
  createProviderAction,
  updateProviderAction,
  deleteProviderAction,
  syncProviderServicesAction,
  checkProviderBalanceAction,
  testProviderConnectionAction,
} from "@/lib/actions/admin";
import { formatCurrency, timeAgo } from "@/lib/utils";

type ProviderRow = {
  id: string;
  name: string;
  api_url: string;
  api_key: string;
  api_key_encrypted: boolean;
  status: "active" | "inactive";
  priority: number;
  balance: number | null;
  last_sync_at: string | null;
  sync_status: string | null;
  sync_message: string | null;
};

const providerFormSchema = z.object({
  name: z.string().min(1),
  apiUrl: z.string().optional().or(z.literal("")),
  apiKey: z.string().optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]),
  priority: z.coerce.number().int(),
});

export function AdminProviders({
  providers,
  serviceCounts,
}: {
  providers: ProviderRow[];
  serviceCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<ProviderRow | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [syncingId, setSyncingId] = React.useState<string | null>(null);
  const [testingId, setTestingId] = React.useState<string | null>(null);
  const [checkingId, setCheckingId] = React.useState<string | null>(null);

  async function sync(providerId: string) {
    setSyncingId(providerId);
    try {
      const result = await syncProviderServicesAction(providerId);
      if (result.success) {
        toast.success(result.message ?? "Synced");
      } else {
        toast.error(result.error ?? "Sync failed");
      }
      router.refresh();
    } finally {
      setSyncingId(null);
    }
  }

  async function checkBalance(providerId: string) {
    setCheckingId(providerId);
    try {
      const result = await checkProviderBalanceAction(providerId);
      if (result.success) {
        toast.success(`Provider balance: ${formatCurrency(result.data?.balance ?? 0)}`);
      } else {
        toast.error(result.error ?? "Failed");
      }
      router.refresh();
    } finally {
      setCheckingId(null);
    }
  }

  async function testConnection(providerId: string) {
    setTestingId(providerId);
    try {
      const result = await testProviderConnectionAction(providerId);
      if (result.success) {
        toast.success(result.message ?? "Connection OK");
      } else {
        toast.error(result.error ?? "Connection failed");
      }
    } finally {
      setTestingId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="gradient" size="sm" onClick={() => setCreating(true)}>
          <Plus /> Add Provider
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {providers.length === 0 ? (
          <div className="lg:col-span-2">
            <EmptyState
              icon={Server}
              title="No providers yet"
              description="Add your SMMFollow API credentials to start importing services."
            />
          </div>
        ) : (
          providers.map((provider) => (
            <Card key={provider.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Server className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold">{provider.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Priority {provider.priority} · {serviceCounts[provider.id] ?? 0} services
                      </p>
                    </div>
                  </div>
                  <Badge variant={provider.status === "active" ? "success" : "destructive"}>
                    {provider.status}
                  </Badge>
                </div>

                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-success" />
                  API key stored server-side only
                  {provider.api_url ? <span>· {provider.api_url}</span> : null}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Balance: {provider.balance != null ? formatCurrency(provider.balance) : "—"}</span>
                  <span>· Last sync: {provider.last_sync_at ? timeAgo(provider.last_sync_at) : "never"}</span>
                </div>

                {provider.sync_status === "error" && provider.sync_message ? (
                  <p className="mt-2 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
                    {provider.sync_message}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => sync(provider.id)} disabled={syncingId === provider.id}>
                    {syncingId === provider.id ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                    Sync Services
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => checkBalance(provider.id)} disabled={checkingId === provider.id}>
                    {checkingId === provider.id ? <Loader2 className="animate-spin" /> : <Wallet />}
                    Balance
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => testConnection(provider.id)} disabled={testingId === provider.id}>
                    {testingId === provider.id ? <Loader2 className="animate-spin" /> : <PlugZap />}
                    Test
                  </Button>
                  <Button variant="ghost" size="iconSm" onClick={() => setEditing(provider)} aria-label="Edit provider">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="iconSm"
                    className="text-destructive hover:text-destructive"
                    onClick={async () => {
                      if (!confirm(`Delete provider "${provider.name}"?`)) return;
                      const result = await deleteProviderAction(provider.id);
                      if (result.success) {
                        toast.success("Provider deleted");
                        router.refresh();
                      } else {
                        toast.error(result.error ?? "Failed");
                      }
                    }}
                    aria-label="Delete provider"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {(creating || editing) ? (
        <ProviderFormDialog
          provider={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      ) : null}
    </div>
  );
}

function ProviderFormDialog({
  provider,
  onClose,
}: {
  provider: ProviderRow | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  const form = useForm<z.infer<typeof providerFormSchema>>({
    resolver: zodResolver(providerFormSchema),
    defaultValues: {
      name: provider?.name ?? "",
      apiUrl: provider?.api_url ?? "",
      apiKey: "",
      status: provider?.status ?? "inactive",
      priority: provider?.priority ?? 0,
    },
  });

  async function onSubmit(values: z.infer<typeof providerFormSchema>) {
    setLoading(true);
    try {
      const result = provider
        ? await updateProviderAction(provider.id, values)
        : await createProviderAction(values);
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
          <DialogTitle>{provider ? "Edit Provider" : "Add Provider"}</DialogTitle>
          <DialogDescription>
            API credentials are stored in the database and only ever read server-side.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Provider Name</Label>
            <Input {...form.register("name")} placeholder="SMMFollow" />
          </div>
          <div className="space-y-2">
            <Label>API URL</Label>
            <Input {...form.register("apiUrl")} placeholder="https://smmfollows.com/api/v2" />
          </div>
          <div className="space-y-2">
            <Label>API Key {provider ? "(leave blank to keep current)" : ""}</Label>
            <Input {...form.register("apiKey")} type="password" placeholder="••••••••" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.watch("status")} onValueChange={(v) => form.setValue("status", v as "active" | "inactive")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Input type="number" {...form.register("priority")} />
            </div>
          </div>
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

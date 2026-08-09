"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Key, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/empty-state";
import { apiKeyCreateSchema } from "@/lib/validations";
import {
  createApiKeyAction,
  deleteApiKeyAction,
  toggleApiKeyAction,
} from "@/lib/actions/admin";
import { formatDateTime, timeAgo } from "@/lib/utils";

type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  permissions: unknown;
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
};

export function AdminApiKeys({ apiKeys }: { apiKeys: ApiKeyRow[] }) {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="gradient" size="sm" onClick={() => setCreating(true)}>
          <Plus /> Create API Key
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {apiKeys.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Key}
                title="No API keys yet"
                description="Create a key so resellers can place orders programmatically via POST /api/smm/v1."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Key</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Permissions</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Last used</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Expires</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Active</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map((apiKey) => {
                    const permissions = (apiKey.permissions as string[]) ?? [];
                    const expired = apiKey.expires_at ? new Date(apiKey.expires_at).getTime() < Date.now() : false;
                    return (
                      <tr key={apiKey.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="px-4 py-3 font-medium">{apiKey.name}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs">{apiKey.key_prefix}••••••••••</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {permissions.length === 0 ? (
                              <span className="text-xs text-muted-foreground">None</span>
                            ) : (
                              permissions.map((permission) => (
                                <Badge key={permission} variant="secondary">{permission}</Badge>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {apiKey.last_used_at ? timeAgo(apiKey.last_used_at) : "Never"}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {apiKey.expires_at ? (
                            <span className={expired ? "text-destructive" : ""}>
                              {formatDateTime(apiKey.expires_at, "MMM d, yyyy")}
                            </span>
                          ) : "Never"}
                        </td>
                        <td className="px-4 py-3">
                          <Switch
                            checked={apiKey.is_active && !expired}
                            onCheckedChange={async (v) => {
                              const result = await toggleApiKeyAction(apiKey.id, v);
                              if (result.success) {
                                toast.success(result.message ?? "Updated");
                                router.refresh();
                              } else {
                                toast.error(result.error ?? "Failed");
                              }
                            }}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="iconSm"
                              className="text-destructive hover:text-destructive"
                              onClick={async () => {
                                if (!confirm(`Delete API key "${apiKey.name}"? Orders already placed are unaffected.`)) return;
                                const result = await deleteApiKeyAction(apiKey.id);
                                if (result.success) {
                                  toast.success("API key deleted");
                                  router.refresh();
                                } else {
                                  toast.error(result.error ?? "Failed");
                                }
                              }}
                              aria-label="Delete API key"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {creating ? <ApiKeyFormDialog onClose={() => setCreating(false)} /> : null}
    </div>
  );
}

function ApiKeyFormDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [createdKey, setCreatedKey] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const form = useForm<z.infer<typeof apiKeyCreateSchema>>({
    resolver: zodResolver(apiKeyCreateSchema),
    defaultValues: {
      name: "",
      permissions: ["orders:create"],
      expiresAt: null,
    },
  });

  const selectedPermissions = form.watch("permissions");

  function handleClose() {
    if (createdKey) {
      router.refresh();
    }
    onClose();
  }

  function togglePermission(permission: string) {
    const current = form.getValues("permissions");
    const next = current.includes(permission)
      ? current.filter((p) => p !== permission)
      : [...current, permission];
    form.setValue("permissions", next);
  }

  async function onSubmit(values: z.infer<typeof apiKeyCreateSchema>) {
    setLoading(true);
    try {
      const result = await createApiKeyAction(values);
      if (result.success) {
        setCreatedKey(result.data?.key ?? null);
        toast.success("API key created");
      } else {
        toast.error(result.error ?? "Failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{createdKey ? "Your API Key" : "Create API Key"}</DialogTitle>
          <DialogDescription>
            {createdKey
              ? "Copy this key now. For security it will never be shown again."
              : "Keys authenticate via the x-api-key header against POST /api/smm/v1."}
          </DialogDescription>
        </DialogHeader>

        {createdKey ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
              <code className="flex-1 break-all font-mono text-xs">{createdKey}</code>
              <Button
                variant="ghost"
                size="iconSm"
                onClick={async () => {
                  await navigator.clipboard.writeText(createdKey);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                aria-label="Copy key"
              >
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Example usage:
            </p>
            <pre className="overflow-x-auto rounded-lg border bg-muted/50 p-3 font-mono text-[11px]">
              {`curl -X POST https://yourdomain.com/api/smm/v1 \\
  -H "x-api-key: ${createdKey.slice(0, 12)}…" \\
  -H "content-type: application/json" \\
  -d '{"service":"1","link":"https://instagram.com/p/xyz","quantity":100}'`}
            </pre>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input {...form.register("name")} placeholder="My Reseller" />
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="flex flex-col gap-2">
                {["orders:create", "orders:read"].map((permission) => (
                  <label key={permission} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={selectedPermissions.includes(permission)}
                      onChange={() => togglePermission(permission)}
                    />
                    <div>
                      <p className="font-mono text-xs font-semibold">{permission}</p>
                      <p className="text-xs text-muted-foreground">
                        {permission === "orders:create"
                          ? "Place orders against the provider (charged from your balance)"
                          : "Query order status (coming soon)"}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Expires At (optional)</Label>
              <Input type="datetime-local" {...form.register("expiresAt")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <Key />}
                Create Key
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

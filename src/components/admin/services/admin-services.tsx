"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Search,
  Loader2,
  Pencil,
  Trash2,
  Power,
  CheckSquare,
  TrendingUp,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/empty-state";
import {
  createServiceAction,
  updateServiceAction,
  deleteServiceAction,
  toggleServicesAction,
  bulkDeleteServicesAction,
  bulkPriceUpdateAction,
} from "@/lib/actions/admin";
import { formatUsd } from "@/lib/utils";

type ServiceRow = {
  id: string;
  name: string;
  category_id: string | null;
  provider_id: string | null;
  provider_service_id: string | null;
  price: number;
  provider_price: number | null;
  min_quantity: number;
  max_quantity: number;
  average_time: string | null;
  type: string | null;
  description: string | null;
  is_active: boolean;
  is_featured: boolean;
  profit_margin: number;
  pricing_mode: "global" | "custom";
  created_at: string;
};

type CategoryRow = { id: string; name: string; slug: string };
type ProviderRow = { id: string; name: string; status: string };

const serviceFormSchema = z.object({
  name: z.string().min(1),
  categoryId: z.string().optional().nullable(),
  providerId: z.string().optional().nullable(),
  providerServiceId: z.string().optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
  price: z.coerce.number().min(0),
  minQuantity: z.coerce.number().int().min(1),
  maxQuantity: z.coerce.number().int().min(1),
  averageTime: z.string().optional().or(z.literal("")),
  type: z.string().optional().or(z.literal("")),
  profitMargin: z.coerce.number().min(-100).max(100),
  pricingMode: z.enum(["global", "custom"]),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
});

export function AdminServices({
  services,
  categories,
  providers,
}: {
  services: ServiceRow[];
  categories: CategoryRow[];
  providers: ProviderRow[];
}) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [editing, setEditing] = React.useState<ServiceRow | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [priceDialog, setPriceDialog] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const filtered = services.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "all" || s.category_id === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      if (prev.size === filtered.length) return new Set();
      return new Set(filtered.map((s) => s.id));
    });
  }

  async function toggleActive(ids: string[], isActive: boolean) {
    setLoading(true);
    try {
      const result = await toggleServicesAction(ids, isActive);
      if (result.success) {
        toast.success(result.message ?? "Updated");
        setSelected(new Set());
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed");
      }
    } finally {
      setLoading(false);
    }
  }

  async function bulkDelete() {
    if (!confirm(`Delete ${selected.size} selected services?`)) return;
    setLoading(true);
    try {
      const result = await bulkDeleteServicesAction([...selected]);
      if (result.success) {
        toast.success(result.message ?? "Deleted");
        setSelected(new Set());
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search services..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="gradient" size="sm" onClick={() => setCreating(true)}>
          Add Service
        </Button>
      </div>

      {selected.size > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button variant="outline" size="sm" onClick={() => toggleActive([...selected], true)}>
            <Power /> Enable
          </Button>
          <Button variant="outline" size="sm" onClick={() => toggleActive([...selected], false)}>
            <Power /> Disable
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPriceDialog(true)}>
            <TrendingUp /> Bulk Price
          </Button>
          <Button variant="destructive" size="sm" onClick={bulkDelete} disabled={loading}>
            <Trash2 /> Delete
          </Button>
        </div>
      ) : null}

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No services found" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="w-10 px-4 py-3">
                      <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Service</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Price</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Provider Price</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Margin</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Mode</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Range</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Active</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((service) => {
                    const cat = categories.find((c) => c.id === service.category_id);
                    const provider = providers.find((p) => p.id === service.provider_id);
                    return (
                      <tr key={service.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="px-4 py-3">
                          <Checkbox checked={selected.has(service.id)} onCheckedChange={() => toggleSelect(service.id)} />
                        </td>
                        <td className="max-w-[260px] px-4 py-3">
                          <p className="line-clamp-1 font-medium">{service.name}</p>
                          <p className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                            <Badge variant="subtle" className="px-1.5 py-0 text-[10px]">{cat?.name ?? "No category"}</Badge>
                            {provider ? (
                              <Badge variant="subtle" className="px-1.5 py-0 text-[10px]">{provider.name}</Badge>
                            ) : null}
                            {service.provider_service_id ? (
                              <span>PID: {service.provider_service_id}</span>
                            ) : null}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-primary">
                          {formatUsd(service.price)}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {service.provider_price != null ? formatUsd(service.provider_price) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">{service.profit_margin}%</td>
                        <td className="px-4 py-3 text-right">
                          <Badge variant={service.pricing_mode === "custom" ? "secondary" : "subtle"} className="px-1.5 py-0 text-[10px]">
                            {service.pricing_mode === "custom" ? "Custom" : "Global"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {service.min_quantity.toLocaleString()} - {service.max_quantity.toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <Switch
                            checked={service.is_active}
                            onCheckedChange={(checked) => toggleActive([service.id], checked)}
                            disabled={loading}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="iconSm" onClick={() => setEditing(service)} aria-label="Edit service">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="iconSm"
                              className="text-destructive hover:text-destructive"
                              onClick={async () => {
                                if (!confirm("Delete this service?")) return;
                                const result = await deleteServiceAction(service.id);
                                if (result.success) {
                                  toast.success("Service deleted");
                                  router.refresh();
                                } else {
                                  toast.error(result.error ?? "Failed");
                                }
                              }}
                              aria-label="Delete service"
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

      {(creating || editing) ? (
        <ServiceFormDialog
          service={editing}
          categories={categories}
          providers={providers}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      ) : null}

      {priceDialog ? (
        <BulkPriceDialog
          count={selected.size}
          onClose={() => setPriceDialog(false)}
          onSubmit={async (mode, value) => {
            setLoading(true);
            try {
              const result = await bulkPriceUpdateAction({ ids: [...selected], mode, value });
              if (result.success) {
                toast.success(result.message ?? "Updated");
                setSelected(new Set());
                setPriceDialog(false);
                router.refresh();
              } else {
                toast.error(result.error ?? "Failed");
              }
            } finally {
              setLoading(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}

function ServiceFormDialog({
  service,
  categories,
  providers,
  onClose,
}: {
  service: ServiceRow | null;
  categories: CategoryRow[];
  providers: ProviderRow[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  const form = useForm<z.infer<typeof serviceFormSchema>>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: {
      name: service?.name ?? "",
      categoryId: service?.category_id ?? null,
      providerId: service?.provider_id ?? null,
      providerServiceId: service?.provider_service_id ?? "",
      description: service?.description ?? "",
      price: service?.price ?? 0,
      minQuantity: service?.min_quantity ?? 1,
      maxQuantity: service?.max_quantity ?? 100,
      averageTime: service?.average_time ?? "",
      type: service?.type ?? "",
      profitMargin: service?.profit_margin ?? 0,
      pricingMode: service?.pricing_mode ?? "global",
      isActive: service?.is_active ?? true,
      isFeatured: service?.is_featured ?? false,
    },
  });

  async function onSubmit(values: z.infer<typeof serviceFormSchema>) {
    setLoading(true);
    try {
      const result = service
        ? await updateServiceAction(service.id, values)
        : await createServiceAction(values);
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
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{service ? "Edit Service" : "Add Service"}</DialogTitle>
          <DialogDescription>
            {service ? `Editing: ${service.name}` : "Create a new service"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input {...form.register("name")} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.watch("categoryId") ?? "none"} onValueChange={(v) => form.setValue("categoryId", v === "none" ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={form.watch("providerId") ?? "none"} onValueChange={(v) => form.setValue("providerId", v === "none" ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Provider Service ID</Label>
            <Input {...form.register("providerServiceId")} placeholder="e.g. 12345" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Price (per 1k)</Label>
              <Input type="number" step="0.01" {...form.register("price")} />
            </div>
            <div className="space-y-2">
              <Label>Min Qty</Label>
              <Input type="number" {...form.register("minQuantity")} />
            </div>
            <div className="space-y-2">
              <Label>Max Qty</Label>
              <Input type="number" {...form.register("maxQuantity")} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Avg Time</Label>
              <Input {...form.register("averageTime")} placeholder="e.g. 1-2 hours" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Input {...form.register("type")} placeholder="e.g. followers" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea {...form.register("description")} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Profit Margin (%)</Label>
            <Input type="number" step="0.01" {...form.register("profitMargin")} />
          </div>
          <div className="space-y-2">
            <Label>Pricing Mode</Label>
            <Select
              value={form.watch("pricingMode")}
              onValueChange={(v) => form.setValue("pricingMode", v as "global" | "custom")}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global Markup (follows global profit %)</SelectItem>
                <SelectItem value="custom">Custom Price (never auto-changed)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Custom Price services keep their manual price and are excluded from global profit &amp; sync updates.
            </p>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.watch("isActive")} onCheckedChange={(v) => form.setValue("isActive", v)} />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.watch("isFeatured")} onCheckedChange={(v) => form.setValue("isFeatured", v)} />
              Featured
            </label>
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

function BulkPriceDialog({
  count,
  onClose,
  onSubmit,
}: {
  count: number;
  onClose: () => void;
  onSubmit: (mode: "percentage" | "margin", value: number) => void;
}) {
  const [mode, setMode] = React.useState<"percentage" | "margin">("percentage");
  const [value, setValue] = React.useState("");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk Price Update</DialogTitle>
          <DialogDescription>
            Apply to {count} selected services.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("percentage")}
              className={`rounded-lg border p-3 text-sm font-medium ${mode === "percentage" ? "border-primary bg-primary/10" : ""}`}
            >
              Adjust by %
            </button>
            <button
              type="button"
              onClick={() => setMode("margin")}
              className={`rounded-lg border p-3 text-sm font-medium ${mode === "margin" ? "border-primary bg-primary/10" : ""}`}
            >
              Set profit margin
            </button>
          </div>
          <div className="space-y-2">
            <Label>
              {mode === "percentage" ? "Adjust price by % (positive = increase)" : "Profit margin %"}
            </Label>
            <Input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => onSubmit(mode, Number(value))}>Apply</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

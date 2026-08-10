"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Search, Loader2, Pencil, Wallet, Ban, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { EmptyState } from "@/components/empty-state";
import {
  updateUserAction,
  adjustUserBalanceAction,
  setUserStatusAction,
} from "@/lib/actions/admin";
import { getInitials, formatCurrency, formatDate } from "@/lib/utils";
import type { Profile } from "@/lib/types/database";

const userFormSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().optional().or(z.literal("")),
  country: z.string().optional().or(z.literal("")),
  currency: z.string(),
  timezone: z.string(),
  status: z.enum(["active", "banned"]),
  role: z.enum(["admin", "user"]),
});

type UserRow = Profile;

export function AdminUsers({
  users,
  currentAdminId,
}: {
  users: UserRow[];
  currentAdminId: string;
}) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [editing, setEditing] = React.useState<UserRow | null>(null);
  const [adjusting, setAdjusting] = React.useState<UserRow | null>(null);
  const [loading, setLoading] = React.useState(false);

  const filtered = users.filter(
    (u) =>
      (u.full_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (u.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No users found" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Balance</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Joined</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((userRow) => (
                    <tr key={userRow.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={userRow.avatar_url ?? undefined} />
                            <AvatarFallback>{getInitials(userRow.full_name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="line-clamp-1 font-medium">{userRow.full_name ?? "User"}</p>
                            <p className="line-clamp-1 text-xs text-muted-foreground">{userRow.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-primary">
                        {formatCurrency(userRow.balance, userRow.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={userRow.role === "admin" ? "info" : "secondary"} className="capitalize">
                          {userRow.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={userRow.status === "active" ? "success" : "destructive"} className="capitalize">
                          {userRow.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(userRow.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="iconSm" onClick={() => setEditing(userRow)} aria-label="Edit user">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="iconSm" onClick={() => setAdjusting(userRow)} aria-label="Adjust balance">
                            <Wallet className="h-3.5 w-3.5" />
                          </Button>
                          {userRow.status === "active" ? (
                            <Button
                              variant="ghost"
                              size="iconSm"
                              className="text-destructive hover:text-destructive"
                              onClick={async () => {
                                const reason = window.prompt("Reason for suspending this user? (optional)");
                                if (reason === null) return;
                                const result = await setUserStatusAction(userRow.id, "banned", reason || undefined);
                                if (result.success) {
                                  toast.success(result.message ?? "User suspended");
                                  router.refresh();
                                } else {
                                  toast.error(result.error ?? "Failed");
                                }
                              }}
                              aria-label="Ban user"
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="iconSm"
                              className="text-success hover:text-success"
                              onClick={async () => {
                                const result = await setUserStatusAction(userRow.id, "active");
                                if (result.success) {
                                  toast.success(result.message ?? "User reactivated");
                                  router.refresh();
                                } else {
                                  toast.error(result.error ?? "Failed");
                                }
                              }}
                              aria-label="Unban user"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <EditUserDialog
        user={editing}
        currentAdminId={currentAdminId}
        onClose={() => setEditing(null)}
      />
      <AdjustBalanceDialog user={adjusting} onClose={() => setAdjusting(null)} />
    </div>
  );
}

function EditUserDialog({
  user,
  currentAdminId,
  onClose,
}: {
  user: UserRow | null;
  currentAdminId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  const form = useForm<z.infer<typeof userFormSchema>>({
    resolver: zodResolver(userFormSchema),
    values: user
      ? {
          fullName: user.full_name ?? "",
          phone: user.phone ?? "",
          country: user.country ?? "",
          currency: user.currency,
          timezone: user.timezone,
          status: user.status,
          role: user.role,
        }
      : undefined,
  });

  if (!user) return null;

  const editingUser = user;

  async function onSubmit(values: z.infer<typeof userFormSchema>) {
    setLoading(true);
    try {
      const result = await updateUserAction(editingUser.id, values);
      if (result.success) {
        toast.success("User updated");
        router.refresh();
        onClose();
      } else {
        toast.error(result.error ?? "Failed to update user");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            {user.full_name ?? user.email} · {user.email}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" {...form.register("fullName")} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...form.register("phone")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input id="country" {...form.register("country")} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select id="role" className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" {...form.register("role")}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select id="status" className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" {...form.register("status")}>
                <option value="active">Active</option>
                <option value="banned">Banned</option>
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <select id="currency" className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" {...form.register("currency")}>
                <option value="BDT">BDT</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input id="timezone" {...form.register("timezone")} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
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

function AdjustBalanceDialog({
  user,
  onClose,
}: {
  user: UserRow | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [amount, setAmount] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [direction, setDirection] = React.useState<"credit" | "debit">("credit");

  if (!user) return null;

  const adjustingUser = user;

  async function submit() {
    const value = Number(amount);
    if (!value || value <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    if (!description.trim()) {
      toast.error("Description is required.");
      return;
    }
    setLoading(true);
    try {
      const finalAmount = direction === "debit" ? -value : value;
      const result = await adjustUserBalanceAction(adjustingUser.id, {
        amount: finalAmount,
        description,
      });
      if (result.success) {
        toast.success("Balance adjusted");
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
          <DialogTitle>Adjust Balance</DialogTitle>
          <DialogDescription>
            {user.full_name ?? user.email} — current balance:{" "}
            {formatCurrency(user.balance, user.currency)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDirection("credit")}
              className={`rounded-lg border p-3 text-sm font-medium transition-colors ${
                direction === "credit" ? "border-success bg-success/10 text-success" : ""
              }`}
            >
              + Credit
            </button>
            <button
              type="button"
              onClick={() => setDirection("debit")}
              className={`rounded-lg border p-3 text-sm font-medium transition-colors ${
                direction === "debit" ? "border-destructive bg-destructive/10 text-destructive" : ""
              }`}
            >
              − Debit
            </button>
          </div>
          <div className="space-y-2">
            <Label>Amount</Label>
            <Input
              type="number"
              min={1}
              placeholder="500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Input
              placeholder="e.g. Manual deposit, compensation, adjustment"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <Wallet />}
              Apply
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

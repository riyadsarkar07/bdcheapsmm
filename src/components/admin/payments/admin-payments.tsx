"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, Loader2, CheckCircle2, XCircle, Eye, FileDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { PaymentStatusBadge } from "@/components/status-badges";
import { approvePaymentAction, rejectPaymentAction } from "@/lib/actions/admin";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { PaymentStatus } from "@/lib/types/database";

type PaymentRow = {
  id: string;
  user_id: string;
  method: string;
  sender_number: string;
  amount: number;
  currency: string;
  transaction_id: string;
  screenshot_url: string | null;
  note: string | null;
  status: PaymentStatus;
  admin_note: string | null;
  created_at: string;
  profiles?: { full_name: string | null; email: string | null } | null;
};

export function AdminPayments({ payments }: { payments: PaymentRow[] }) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [viewing, setViewing] = React.useState<PaymentRow | null>(null);
  const [rejecting, setRejecting] = React.useState<PaymentRow | null>(null);
  const [reason, setReason] = React.useState("");
  const [loading, setLoading] = React.useState<string | null>(null);

  const filtered = payments.filter((p) => {
    const matchesSearch =
      p.transaction_id.toLowerCase().includes(search.toLowerCase()) ||
      p.sender_number.toLowerCase().includes(search.toLowerCase()) ||
      (p.profiles?.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.profiles?.full_name ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  async function approve(payment: PaymentRow) {
    setLoading(payment.id);
    try {
      const result = await approvePaymentAction(payment.id);
      if (result.success) {
        toast.success(`Approved ${formatCurrency(payment.amount, payment.currency)} deposit`);
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed");
      }
    } finally {
      setLoading(null);
    }
  }

  async function reject() {
    if (!rejecting) return;
    setLoading(rejecting.id);
    try {
      const result = await rejectPaymentAction(rejecting.id, reason);
      if (result.success) {
        toast.success("Payment rejected");
        setRejecting(null);
        setReason("");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed");
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by trx ID, number or email..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No payment requests found" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Method</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Sender</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Trx ID</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((payment) => (
                    <tr key={payment.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="max-w-[160px] px-4 py-3">
                        <p className="line-clamp-1 font-medium">{payment.profiles?.full_name ?? "User"}</p>
                        <p className="line-clamp-1 text-xs text-muted-foreground">{payment.profiles?.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">{payment.method}</Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{payment.sender_number}</td>
                      <td className="px-4 py-3 text-right font-semibold text-primary">
                        {formatCurrency(payment.amount, payment.currency)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{payment.transaction_id}</td>
                      <td className="px-4 py-3">
                        <PaymentStatusBadge status={payment.status} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDateTime(payment.created_at, "MMM d, h:mm a")}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="iconSm" onClick={() => setViewing(payment)} aria-label="View payment">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {payment.status === "approved" ? (
                            <Button asChild variant="ghost" size="iconSm" className="text-primary hover:text-primary" aria-label="Download invoice">
                              <a
                                href={`/api/payments/${payment.id}/invoice`}
                                download={`invoice-${payment.id}.pdf`}
                              >
                                <FileDown className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                          ) : null}
                          {payment.status === "pending" ? (
                            <>
                              <Button
                                variant="ghost"
                                size="iconSm"
                                className="text-success hover:text-success"
                                onClick={() => approve(payment)}
                                disabled={loading === payment.id}
                                aria-label="Approve"
                              >
                                {loading === payment.id ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="iconSm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setRejecting(payment)}
                                disabled={loading === payment.id}
                                aria-label="Reject"
                              >
                                <XCircle />
                              </Button>
                            </>
                          ) : payment.admin_note ? (
                            <span className="max-w-[140px] truncate text-[11px] text-muted-foreground" title={payment.admin_note}>
                              {payment.admin_note}
                            </span>
                          ) : null}
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

      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment Request</DialogTitle>
            <DialogDescription>
              {viewing?.method} · {viewing ? formatCurrency(viewing.amount, viewing.currency) : ""} · {viewing?.transaction_id}
            </DialogDescription>
          </DialogHeader>
          {viewing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Sender</p>
                  <p className="font-medium">{viewing.sender_number}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">User</p>
                  <p className="line-clamp-1 font-medium">{viewing.profiles?.full_name ?? viewing.profiles?.email}</p>
                </div>
              </div>
              {viewing.note ? (
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <p className="text-xs text-muted-foreground">Note</p>
                  <p>{viewing.note}</p>
                </div>
              ) : null}
              {viewing.screenshot_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={viewing.screenshot_url}
                  alt="Payment screenshot"
                  className="w-full rounded-lg border object-contain"
                />
              ) : (
                <p className="rounded-lg bg-muted/50 p-3 text-center text-sm text-muted-foreground">
                  No screenshot uploaded.
                </p>
              )}
              {viewing.status === "approved" ? (
                <div className="flex justify-end pt-1">
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={`/api/payments/${viewing.id}/invoice`}
                      download={`invoice-${viewing.id}.pdf`}
                    >
                      <FileDown className="h-3.5 w-3.5" />
                      Download Invoice
                    </a>
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejecting} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Payment</DialogTitle>
            <DialogDescription>
              {rejecting ? formatCurrency(rejecting.amount, rejecting.currency) : ""} · Provide a reason shown to the user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Transaction ID not found, wrong amount sent..."
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
              <Button variant="destructive" onClick={reject} disabled={loading === rejecting?.id}>
                {loading === rejecting?.id ? <Loader2 className="animate-spin" /> : <XCircle />}
                Reject Payment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

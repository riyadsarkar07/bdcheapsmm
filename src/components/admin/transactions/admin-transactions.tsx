"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { TransactionType } from "@/lib/types/database";

type TransactionRow = {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  balance_after: number | null;
  description: string | null;
  reference_type: string | null;
  currency: string;
  created_at: string;
  profiles?: { full_name: string | null; email: string | null } | null;
};

const typeStyles: Record<TransactionType, "success" | "destructive" | "secondary" | "warning"> = {
  deposit: "success",
  order_deduction: "destructive",
  refund: "warning",
  adjustment: "secondary",
};

export function AdminTransactions({ transactions }: { transactions: TransactionRow[] }) {
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("all");

  const filtered = transactions.filter((t) => {
    const matchesSearch =
      (t.profiles?.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (t.profiles?.full_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (t.description ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (t.reference_type ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || t.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by user or reference..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="deposit">Deposit</SelectItem>
            <SelectItem value="order_deduction">Order charge</SelectItem>
            <SelectItem value="refund">Refund</SelectItem>
            <SelectItem value="adjustment">Adjustment</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No transactions found" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Description</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Balance after</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((transaction) => {
                    const isCredit = transaction.type === "deposit" || transaction.type === "refund";
                    return (
                      <tr key={transaction.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="max-w-[160px] px-4 py-3">
                          <p className="line-clamp-1 font-medium">{transaction.profiles?.full_name ?? "User"}</p>
                          <p className="line-clamp-1 text-xs text-muted-foreground">{transaction.profiles?.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={typeStyles[transaction.type]}>{transaction.type.replace("_", " ")}</Badge>
                        </td>
                        <td className="max-w-[280px] px-4 py-3">
                          <p className="line-clamp-1 text-muted-foreground">{transaction.description ?? "—"}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          <span className={isCredit ? "text-success" : "text-destructive"}>
                            {isCredit ? "+" : "−"}
                            {formatCurrency(transaction.amount, transaction.currency)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {transaction.balance_after != null ? formatCurrency(transaction.balance_after, transaction.currency) : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDateTime(transaction.created_at, "MMM d, h:mm a")}
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
    </div>
  );
}

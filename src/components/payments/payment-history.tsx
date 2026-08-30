import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PaymentStatusBadge } from "@/components/status-badges";
import { EmptyState } from "@/components/empty-state";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { FileDown, History } from "lucide-react";
import type { PaymentRequest, PaymentStatus } from "@/lib/types/database";

export function PaymentHistory({ requests }: { requests: PaymentRequest[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" /> Deposit History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <EmptyState
            title="No deposits yet"
            description="Your payment requests will appear here."
          />
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold">
                    {formatCurrency(request.amount, request.currency)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {request.method} · {request.transaction_id}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(request.created_at)}
                  </p>
                  {request.admin_note ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Note: {request.admin_note}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <PaymentStatusBadge status={request.status as PaymentStatus} />
                  {request.status === "approved" ? (
                    <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs">
                      <Link
                        href={`/api/payments/${request.id}/invoice`}
                        download={`invoice-${request.id}.pdf`}
                      >
                        <FileDown className="h-3.5 w-3.5" />
                        Invoice
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import type {
  OrderStatus,
  PaymentStatus,
  TicketStatus,
  TransactionType,
} from "@/lib/types/database";
import { Badge } from "@/components/ui/badge";

const orderStatusMap: Record<OrderStatus, { label: string; variant: "success" | "warning" | "destructive" | "info" | "subtle" | "secondary" }> = {
  pending: { label: "Pending", variant: "warning" },
  processing: { label: "Processing", variant: "info" },
  in_progress: { label: "In Progress", variant: "info" },
  completed: { label: "Completed", variant: "success" },
  partial: { label: "Partial", variant: "warning" },
  cancelled: { label: "Cancelled", variant: "destructive" },
  refunded: { label: "Refunded", variant: "secondary" },
  failed: { label: "Failed", variant: "destructive" },
  rejected: { label: "Rejected", variant: "destructive" },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const config = orderStatusMap[status] ?? { label: status, variant: "subtle" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

const paymentStatusMap: Record<PaymentStatus, { label: string; variant: "success" | "warning" | "destructive" }> = {
  pending: { label: "Pending", variant: "warning" },
  approved: { label: "Approved", variant: "success" },
  rejected: { label: "Rejected", variant: "destructive" },
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const config = paymentStatusMap[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

const ticketStatusMap: Record<TicketStatus, { label: string; variant: "success" | "warning" | "secondary" }> = {
  open: { label: "Open", variant: "success" },
  waiting: { label: "Waiting", variant: "warning" },
  closed: { label: "Closed", variant: "secondary" },
};

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const config = ticketStatusMap[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

const transactionTypeMap: Record<TransactionType, { label: string; variant: "success" | "destructive" | "info" | "secondary" }> = {
  deposit: { label: "Deposit", variant: "success" },
  order_deduction: { label: "Order", variant: "destructive" },
  refund: { label: "Refund", variant: "info" },
  adjustment: { label: "Adjustment", variant: "secondary" },
};

export function TransactionTypeBadge({ type }: { type: TransactionType }) {
  const config = transactionTypeMap[type];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

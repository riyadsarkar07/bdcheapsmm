import Link from "next/link";
import { requireAdmin } from "@/lib/guards";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

export default async function RefundReport({ searchParams }: {
  searchParams: Promise<{ page?: string; q?: string; scope?: string }>;
}) {
  const { user } = await requireAdmin();
  if (!user) return null;
  const params = await searchParams;
  const page = Math.max(1, Math.floor(Number(params.page) || 1));
  const q = (params.q ?? "").trim().replace(/^#/, "");
  const scope = params.scope === "refunds" ? "refunds" : "all";
  const db = await createClient();
  let query = db.from("orders")
    .select("id,order_number,status,provider_response", { count: "exact" });
  if (scope === "refunds") query = query.in("status", ["refunded", "cancelled"]);
  if (q) query = query.ilike("order_number", "%" + q.replace(/[\\%_]/g, "\\$&") + "%");
  const { data, count, error } = await query.order("created_at", { ascending: false })
    .order("id").range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (error) throw new Error("Unable to load the refund report");
  const orders = data ?? [];
  const ids = orders.map(o => o.id);
  const ledger = ids.length ? await db.from("transactions").select("reference_id,type,amount,currency")
    .eq("reference_type", "orders").in("reference_id", ids).in("type", ["order_deduction", "refund"]) : { data: [], error: null };
  if (ledger.error) throw new Error("Unable to load wallet transactions");
  const href = (p: number) => "/admin/refunds?" + new URLSearchParams({ page: String(p), q, scope });
  return <section className="space-y-4">
    <PageHeader title="Refund reconciliation" description="Compare provider updates with recorded wallet charges and credits." />
    <form className="flex flex-wrap gap-2">
      <select aria-label="Order scope" name="scope" defaultValue={scope} className="rounded-md border bg-background px-2">
        <option value="all">All orders</option><option value="refunds">Cancelled or refunded</option>
      </select><Input className="w-48" name="q" defaultValue={q} placeholder="Order number" aria-label="Order number" /><Button>Search</Button></form>
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted"><tr>{["Order", "Panel status", "Provider status", "Wallet debit", "Refund credited", "Result"].map(h => <th className="p-3" key={h}>{h}</th>)}</tr></thead>
        <tbody>{orders.map(o => {
          const rows = ledger.data?.filter(t => t.reference_id === o.id) ?? [];
          const units = [...new Set(rows.map(t => t.currency))];
          const sums = units.map(unit => {
            const entries = rows.filter(t => t.currency === unit);
            const sum = (type: string) => entries.reduce((n,t) => n + (t.type === type ? Math.round(t.amount * 100) : 0), 0);
            return { unit, debit: -sum("order_deduction"), credit: sum("refund") };
          });
          const raw = o.provider_response;
          const provider = raw && typeof raw === "object" && !Array.isArray(raw) && typeof raw.status === "string" ? raw.status : null;
          const expected = ["cancelled","refunded"].includes(o.status) || /^(cancelled|canceled|refunded)$/i.test(provider ?? "");
          const hasRefund = rows.some(t => t.type === "refund");
          const result = expected || hasRefund
            ? (sums.length && sums.every(s => s.debit > 0 && s.debit === s.credit) && o.status === "refunded" ? "Matched" : "Review")
            : "No refund recorded";
          return <tr className="border-t" key={o.id}>
            <td className="p-3"><Link className="text-primary" href={`/orders/${o.id}`}>#{o.order_number}</Link></td>
            <td className="p-3">{o.status}</td><td className="p-3">{provider ?? "Not recorded"}</td>
            <td className="p-3">{sums.map(s => formatCurrency(s.debit / 100,s.unit)).join(" + ") || "—"}</td>
            <td className="p-3">{sums.map(s => formatCurrency(s.credit / 100,s.unit)).join(" + ") || "—"}</td>
            <td className={result === "Review" ? "p-3 font-semibold text-warning" : "p-3"}>{result}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    {!orders.length && <p>No matching orders.</p>}
    <nav className="flex items-center gap-4 text-sm">{page > 1 && <Link href={href(page-1)}>Previous</Link>}
      <span>Page {page} · {count ?? 0} orders</span>
      {page * PAGE_SIZE < (count ?? 0) && <Link href={href(page+1)}>Next</Link>}
    </nav>
  </section>;
}

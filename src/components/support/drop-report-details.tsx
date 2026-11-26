import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CustomerText } from "@/components/customer-language";

export async function DropReportDetails({ ticketId }: { ticketId:string }) {
  const db = await createClient();
  const {data} = await db.from("order_drop_reports").select("order_id,screenshot_path").eq("ticket_id", ticketId).maybeSingle();
  if (!data) return null;
  const image = data.screenshot_path && (await db.storage.from("drop-evidence").createSignedUrl(data.screenshot_path,600)).data;
  return <nav className="glass-card mb-4 flex flex-wrap gap-4 p-4 text-sm font-semibold text-primary">
    <Link href={"/orders/" + data.order_id}><CustomerText value="Order timeline" /></Link>
    {image && <a href={image.signedUrl} target="_blank" rel="noreferrer"><CustomerText value="View screenshot" /></a>}
  </nav>;
}

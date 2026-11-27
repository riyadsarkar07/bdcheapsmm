import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CustomerText } from "@/components/customer-language";

export async function DropReportDetails({ ticketId }: { ticketId:string }) {
  const db = await createClient();
  const {data} = await db.from("order_drop_reports").select("order_id,user_id,screenshot_path").eq("ticket_id", ticketId).maybeSingle();
  if (!data) return null;
  const image = data.screenshot_path && (await db.storage.from("drop-evidence").createSignedUrl(data.screenshot_path,600)).data;
  const {data:auth}=await db.auth.getUser();
  const {data:updates}=await db.from("drop_updates").select("id,current_count,screenshot_path,created_at").eq("ticket_id",ticketId).order("created_at");
  const entries=await Promise.all((updates||[]).map(async u=>({...u,url:u.screenshot_path?(await db.storage.from("drop-evidence").createSignedUrl(u.screenshot_path,600)).data?.signedUrl:null})));
  return <nav className="glass-card mb-4 flex flex-wrap gap-4 p-4 text-sm font-semibold text-primary">
    <Link href={"/orders/" + data.order_id}><CustomerText value="Order timeline" /></Link>
    {auth.user?.id===data.user_id&&<Link href={"/support/new?drop=1&order="+data.order_id}><CustomerText value="Add report evidence"/></Link>}
    {entries.map(u=><div key={u.id} className="w-full border-t">{new Date(u.created_at).toLocaleString("en-GB",{timeZone:"Asia/Dhaka"})} (Dhaka) · {u.current_count??"—"} {u.url&&<a href={u.url} target="_blank" rel="noreferrer"><CustomerText value="View screenshot"/></a>}</div>)}
    {image && <a href={image.signedUrl} target="_blank" rel="noreferrer"><CustomerText value="View screenshot" /></a>}
  </nav>;
}

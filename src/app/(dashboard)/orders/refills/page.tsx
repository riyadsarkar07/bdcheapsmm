import Link from "next/link";
import {requireUser} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {CustomerText} from "@/components/customer-language";
import {dhakaTime} from "@/lib/customer-order";
export default async function Refills({searchParams}:{searchParams:Promise<{page?:string}>}){
  const {user}=await requireUser();if(!user)return null;
  const page=Math.max(1,Math.floor(Number((await searchParams).page)||1)),db=await createClient();
  const {data,error}=await db.from("customer_refill_activity").select("*").order("created_at",{ascending:false}).order("id").range((page-1)*30,page*30);
  return <main><h1 className="mb-4 text-2xl font-bold"><CustomerText value="My refill requests"/></h1>
    {error?<p>Could not load requests.</p>:!data?.length?<CustomerText value="No refill requests yet"/>:data.slice(0,30).map(r=><article key={r.id} className="glass-card mb-2 p-4">
      <Link href={"/orders/"+r.order_id} className="text-primary underline">#{r.order_number}</Link><p><CustomerText value={r.event}/></p><small>{dhakaTime(r.created_at)}</small>
      {r.ticket_id&&<Link className="ml-2 underline" href={"/support/"+r.ticket_id}><CustomerText value="View report"/></Link>}</article>)}
    {page>1&&<Link href={"?page="+(page-1)}><CustomerText value="Prev"/></Link>} {data&&data.length>30&&<Link href={"?page="+(page+1)}><CustomerText value="Next"/></Link>}</main>;
}

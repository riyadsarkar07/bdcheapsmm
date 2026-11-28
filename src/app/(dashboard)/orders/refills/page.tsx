import {setReminder} from "@/lib/actions/refill-reminder";
import {refillBlock} from "@/lib/refill-eligibility";
import {refillDeadline} from "@/lib/customer-order";
import Link from "next/link";
import {requireUser} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {CustomerText} from "@/components/customer-language";
import {dhakaTime} from "@/lib/customer-order";
export default async function Refills({searchParams}:{searchParams:Promise<{page?:string}>}){
  const {user}=await requireUser();if(!user)return null;
  const page=Math.max(1,Math.floor(Number((await searchParams).page)||1)),db=await createClient();
  const {data,error}=await db.from("customer_refill_activity").select("*").order("created_at",{ascending:false}).order("id").range((page-1)*30,page*30);
  const eligible:{id:string;number:string;end:string|null}[]=[];
  for(let offset=0;;offset+=250){
    const result=await db.from("orders").select("id,order_number,provider_id,provider_order_id,status,provider_response,provider_refill_status,refill_claimed_at,refill_count,services(meta,name,description)").eq("user_id",user.id).in("status",["partial","completed"]).not("provider_order_id","is",null).order("id").range(offset,offset+249);
    if(result.error)throw result.error;
    for(const o of result.data)if(!refillBlock(o))eligible.push({id:o.id,number:o.order_number,end:refillDeadline(o.provider_response)});
    if(result.data.length<250)break;
  }
  eligible.sort((a,b)=>(a.end||"z").localeCompare(b.end||"z"));
  const {data:reminders}=await db.from("refill_reminders").select("order_id,sent_at").eq("user_id",user.id);
  return <main><section className="glass-card mb-4 space-y-2 p-4"><h2><CustomerText value="Eligible refills"/> ({eligible.length})</h2>{eligible.slice((page-1)*30,page*30).map(o=>{
    const reminder=reminders?.find(r=>r.order_id===o.id);
    return <article className="flex flex-wrap justify-between gap-2 border-t py-2" key={o.id}><Link className="underline" href={"/orders/"+o.id}>#{o.number}</Link> {o.end?dhakaTime(o.end):<CustomerText value="Deadline unconfirmed"/>} {o.end&&(reminder?.sent_at?<CustomerText value="Reminder sent"/>:<form action={setReminder.bind(null,o.id,!reminder)}><button className="underline"><CustomerText value={reminder?"Cancel reminder":"Remind me before expiry"}/></button></form>)}</article>;
  })}{eligible.length>page*30&&<Link href={"?page="+(page+1)}><CustomerText value="More eligible orders"/></Link>}</section><h1 className="mb-4 text-2xl font-bold"><CustomerText value="My refill requests"/></h1>
    {error?<p><CustomerText value="Could not load requests."/></p>:!data?.length?<CustomerText value="No refill requests yet"/>:data.slice(0,30).map(r=><article key={r.id} className="glass-card mb-2 p-4">
      <Link href={"/orders/"+r.order_id} className="text-primary underline">#{r.order_number}</Link><p><CustomerText value={r.event}/></p><small>{dhakaTime(r.created_at)}</small>
      {r.ticket_id&&<Link className="ml-2 underline" href={"/support/"+r.ticket_id}><CustomerText value="View report"/></Link>}</article>)}
    {page>1&&<Link href={"?page="+(page-1)}><CustomerText value="Prev"/></Link>} {data&&data.length>30&&<Link href={"?page="+(page+1)}><CustomerText value="Next"/></Link>}</main>;
}

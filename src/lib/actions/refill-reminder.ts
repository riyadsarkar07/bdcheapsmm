"use server";
import {requireUser} from "@/lib/guards";
import {createAdminClient} from "@/lib/supabase/admin";
import {refillDeadline} from "@/lib/customer-order";
import {refillBlock} from "@/lib/refill-eligibility";
import {revalidatePath} from "next/cache";
export async function setReminder(orderId:string,enabled:boolean){
 const {user}=await requireUser();if(!user)return;const db=createAdminClient();
 if(enabled){
  const {data:o}=await db.from("orders").select("*,services(meta,name,description)").eq("id",orderId).eq("user_id",user.id).maybeSingle();
  if(!o||refillBlock(o))return;const deadline=refillDeadline(o.provider_response);if(!deadline)return;
  const {error}=await db.from("refill_reminders").upsert({order_id:orderId,user_id:user.id,deadline},{ignoreDuplicates:true});if(error)throw error;
 }else{await db.from("refill_reminders").delete().eq("order_id",orderId).eq("user_id",user.id).is("sent_at",null);}
 revalidatePath("/orders/refills");
}

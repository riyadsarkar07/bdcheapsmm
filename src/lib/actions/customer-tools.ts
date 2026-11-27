"use server";
import {requireUser} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {revalidatePath} from "next/cache";
export async function saveOrderNote(orderId:string,form:FormData){
  const {user}=await requireUser();if(!user)throw Error("Login required");
  const db=await createClient();
  const {error}=await db.from("order_notes").upsert({order_id:orderId,user_id:user.id,note:String(form.get("note")||"").trim().slice(0,160)});
  if(error)throw Error("Could not save project note");
  revalidatePath("/orders/"+orderId);
}
export async function saveAlerts(form:FormData){
  const {user}=await requireUser();if(!user)throw Error("Login required");
  const topics=["orders","wallet","support","catalog"],db=await createClient();
  const {error}=await db.from("customer_alert_preferences").upsert({user_id:user.id,inbox:topics.filter(v=>form.getAll("inbox").includes(v)),email:topics.filter(v=>form.getAll("email").includes(v))});
  if(error)throw Error("Could not save alert preferences");
  revalidatePath("/notifications");
}

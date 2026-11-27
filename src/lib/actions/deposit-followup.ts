"use server";
import {requireAdmin,requireUser} from "@/lib/guards";
import {createAdminClient} from "@/lib/supabase/admin";
import {createClient} from "@/lib/supabase/server";
import {revalidatePath} from "next/cache";
export async function requestCorrection(id:string,reason:string){
 const {user}=await requireAdmin();if(!user||!reason.trim()||reason.length>400)return "Enter a correction reason.";
 const {data}=await createAdminClient().from("payment_requests").update({correction_reason:reason.trim()}).eq("id",id).eq("status","pending").select("id").maybeSingle();
 if(!data)return "Payment is no longer pending.";revalidatePath("/admin/payments");return "";
}
export async function correctDeposit(id:string,fields:{sender:string;tx:string;amount:number}){
 const {user}=await requireUser();if(!user||!/^\+?[\d -]{10,20}$/.test(fields.sender)||fields.tx.trim().length<4||fields.tx.length>100||!Number.isFinite(fields.amount)||fields.amount<=0||fields.amount>100000)return "Check the sender, reference and amount.";
 const {data}=await createAdminClient().from("payment_requests").update({transaction_id:fields.tx.trim(),sender_number:fields.sender.trim(),amount:fields.amount,correction_reason:null}).eq("id",id).eq("user_id",user.id).eq("status","pending").not("correction_reason","is",null).select("id").maybeSingle();
 if(!data)return "Could not save correction. Check your reference and refresh.";revalidatePath("/add-funds");return "";
}
export async function depositHelp(id:string){
 const {user}=await requireUser();if(!user)return null;
 const db=await createClient();const {data}=await db.rpc("deposit_help",{p_id:id});return data;
}

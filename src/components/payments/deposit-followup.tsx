"use client";
import {CustomerText} from "@/components/customer-language";
import {useRouter} from "next/navigation";
import {toast} from "sonner";
import type {PaymentRequest} from "@/lib/types/database";
import {requestCorrection,correctDeposit,depositHelp} from "@/lib/actions/deposit-followup";
export function StaffCorrection({id}:{id:string}){
 return <details><summary>Request correction</summary><form action={async fd=>{const msg=await requestCorrection(id,String(fd.get("reason")));if(msg)toast.error(msg);else toast.success("Correction requested");}}><input name="reason" required maxLength={400} placeholder="Reason shown to customer"/><button>Request correction</button></form></details>;
}
export function DepositFollowup({p}:{p:PaymentRequest}){
 const router=useRouter();return <div className="text-sm"><button className="underline" onClick={async()=>{const id=await depositHelp(p.id);if(id)router.push("/support/"+id);else toast.error("Could not open ticket");}}><CustomerText value="Get deposit help"/></button>
 {p.status==="pending"&&p.correction_reason&&<form className="grid gap-1" action={async fd=>{const msg=await correctDeposit(p.id,{tx:String(fd.get("tx")),amount:Number(fd.get("amount")),sender:String(fd.get("sender"))});if(msg)toast.error(msg);else router.refresh();}}>
 <p>Correction requested · {p.correction_reason}</p><label>Transaction ID<input required name="tx" defaultValue={p.transaction_id}/></label><label>Sender number<input required name="sender" defaultValue={p.sender_number}/></label><label>Amount (BDT)<input required name="amount" type="number" step=".01" defaultValue={p.amount}/></label><button><CustomerText value="Submit corrected details"/></button></form>}</div>;
}

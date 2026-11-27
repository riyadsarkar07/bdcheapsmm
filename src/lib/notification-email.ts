import {createAdminClient} from "@/lib/supabase/admin";
export async function deliverNotificationEmails(){
  const token=process.env.RESEND_API_KEY,from=process.env.NOTIFICATION_EMAIL_FROM;
  if(!token||!from)return 0;
  const db=createAdminClient();
  const {data,error}=await db.from("customer_email_queue").select("id,user_id,topic,attempts").is("delivered_at",null).lt("attempts",5)
    .gte("created_at",new Date(Date.now()-23*3600000).toISOString()).order("created_at").limit(8);
  if(error)throw Error("Could not read email queue");
  let sent=0;
  for(const item of data){
    const claim=await db.from("customer_email_queue").update({attempts:item.attempts+1}).eq("id",item.id).eq("attempts",item.attempts).is("delivered_at",null).select("id").maybeSingle();
    if(!claim.data)continue;
    const prefs=await db.from("customer_alert_preferences").select("email").eq("user_id",item.user_id).maybeSingle();
    const account=await db.auth.admin.getUserById(item.user_id);
    if(prefs.error||account.error)continue;
    if(prefs.data?.email.includes(item.topic)&&account.data.user.email_confirmed_at&&account.data.user.email){
      try{
        const res=await fetch("https://api.resend.com/emails",{method:"POST",signal:AbortSignal.timeout(3500),headers:{Authorization:"Bearer "+token,"Content-Type":"application/json","Idempotency-Key":item.id},
          body:JSON.stringify({from,to:[account.data.user.email],subject:"BD Cheap SMM · "+item.topic+" update",text:"You have a new "+item.topic+" update. Open your BD Cheap SMM dashboard to view it. Manage email preferences under Notifications."})});
        if(!res.ok)continue;
        sent++;
      }catch{continue;}
    }
    await db.from("customer_email_queue").update({delivered_at:new Date().toISOString()}).eq("id",item.id);
  }
  return sent;
}

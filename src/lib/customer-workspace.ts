import {createClient} from "@/lib/supabase/client";
import type {Json} from "@/lib/types/database";
export async function persist(user:string,key:string,value:Json){
 const {error}=await createClient().from("customer_settings").upsert({user_id:user,key,value});
 if(error)throw Error("Could not save to your account.");
}
export async function preference(user:string,key:string){
 const {data,error}=await createClient().from("customer_settings").select("value").eq("user_id",user).eq("key",key).maybeSingle();
 if(error)throw error;return data?.value;
}

"use client";
import { createContext, useContext, useState } from "react";
import { customerText } from "@/lib/customer-text";

const Language = createContext<{ code: string; change: (value: string) => void }>({ code: "en", change: () => {} });

export function CustomerLanguage({ initial, children }: { initial: string; children: React.ReactNode }) {
  const [code, setCode] = useState(initial);
  function change(value: string) {
    document.cookie = "customer_language=" + value + "; Path=/; Max-Age=31536000; SameSite=Lax";
    setCode(value);
  }
  return <Language.Provider value={{ code, change }}><div lang={code}>{children}</div></Language.Provider>;
}

export function LanguageSwitch() {
  const { code, change } = useContext(Language);
  return <select aria-label="Language / ভাষা" value={code} onChange={e => change(e.target.value)} className="rounded-md border bg-background p-1 text-sm">
    <option value="en">English</option><option value="bn">বাংলা</option>
  </select>;
}

export function useCustomerText() {
  const { code } = useContext(Language);
  return (text: string) => customerText(code, text);
}

export function CustomerText({ value }: { value: string }) {
  return useCustomerText()(value);
}

export function ProviderStatusText({ value }: { value: string }) {
  const t = useCustomerText();
  const normalized = value.toLowerCase().replace(/_/g," ");
  const key = ["Pending","Processing","In Progress","Completed","Partial","Cancelled","Canceled","Refunded","Failed","Rejected"].find(k => k.toLowerCase() === normalized);
  if (!key) return t(value);
  const translated = t(key);
  return translated === key ? value : value + " · " + translated;
}

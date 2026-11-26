"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCustomerText } from "@/components/customer-language";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DropReport({ order, number, provider, userId }: { order: string; number: string; provider: string | null; userId: string }) {
  const t = useCustomerText();
  const router = useRouter();
  const [count, setCount] = useState("");
  const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef("");
  const uploaded = useRef("");
  return <form className="glass-card mx-auto max-w-lg space-y-4 p-5" onSubmit={async event => {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (!count && !file) { setError(t("Add a count or screenshot")); return; }
    if (file && (file.size > 5242880 || !["image/jpeg","image/png","image/webp"].includes(file.type))) {
      setError(t("Use JPG, PNG or WebP up to 5 MB")); return;
    }
    setBusy(true);
    try {
      const db = createClient();
      request.current ||= crypto.randomUUID();
      if (file && !uploaded.current) {
        const path = userId + "/" + crypto.randomUUID();
        const upload = await db.storage.from("drop-evidence").upload(path,file,{ contentType: file.type });
        if (upload.error) throw upload.error;
        uploaded.current = path;
      }
      const result = await db.rpc("create_drop_report", {p_order:order,p_request:request.current,p_count:count ? Number(count) : null,p_path:uploaded.current || null});
      if (result.error) throw result.error;
      router.replace("/support/" + result.data);
    } catch (err) {
      setError(err && typeof err === "object" && "message" in err ? String(err.message) : t("Could not submit report"));
      setBusy(false);
    }
  }}>
    <h1 className="text-xl font-semibold">{t("Report follower drop")}</h1>
    <p>{t("Order")} #{number}<br/>{t("Provider Order ID")} · {provider ?? "—"}</p>
    <label className="block">{t("Current follower count")}<Input disabled={busy} type="number" min="0" max="2147483647" step="1" value={count} onChange={e=>setCount(e.target.value)} /></label>
    <label className="block">{t("Screenshot")}<Input disabled={busy} type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{setFile(e.target.files?.[0]); uploaded.current="";}} /></label>
    <p className="text-sm text-muted-foreground">{t("Add a count or screenshot")} · {t("Use JPG, PNG or WebP up to 5 MB")}</p>
    {error && <p role="alert">{error}</p>}
    <Button disabled={busy}>{t("Submit report")}</Button>
  </form>;
}

"use client";

import { createPortal } from "react-dom";
import { CustomerText } from "@/components/customer-language";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { motion, useReducedMotion } from "framer-motion";
import {
  Loader2,
  ShoppingCart,
  Tag,
  Zap,
  AlertTriangle,
  Wallet,
  Clock,
  Minus,
  Plus,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { createOrderAction,lookupCheckout,quoteCouponAction } from "@/lib/actions/orders";
import { checkUrlConflictAction, type UrlConflict } from "@/lib/actions/url-check";
import { formatUsd, formatCurrency } from "@/lib/utils";
import { computeOrderCharge, walletCharge, hasSufficientBalance } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/client";
import { useQuery,useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { targetLinkError } from "@/lib/order-link";
import { useCustomerText } from "@/components/customer-language";
import { Badge } from "@/components/ui/badge";

const formSchema = z.object({
  quantity: z.coerce
    .number()
    .int("Whole number required")
    .min(1, "Quantity is required"),
  link: z
    .string()
    .min(5, "Link is required")
    .max(2048)
    .refine((v) => /^https?:\/\/.+/i.test(v), "Enter a valid URL starting with http:// or https://"),
  coupon: z.string().max(50).optional().or(z.literal("")),
});

interface OrderFormProps {
  userId:string; serviceType:string|null;
  serviceId: string;
  serviceName: string;
  providerServiceId: string | number | null;
  platform: string;
  refillLabel: string;
  /** Retail price per 1000 units (same as the provider rate + markup). */
  pricePerUnit: number;
  minQuantity: number;
  maxQuantity: number;
  balance: number;
  currency: string;
  previous?: { quantity: number; link: string } | null;
  linkPlaceholder?: string;
  /** Human-readable provider ETA, e.g. "0-1 hours". */
  averageTime?: string | null;
}

export function OrderForm({userId,serviceType,
  serviceId,
  serviceName,
  providerServiceId,
  platform,
  refillLabel,
  pricePerUnit,
  minQuantity,
  maxQuantity,
  balance,
  currency,
  previous,
  linkPlaceholder,
  averageTime,
}: OrderFormProps) {
  const t = useCustomerText();
  const {data:incident}=useQuery({queryKey:["service-incident",serviceId],staleTime:300000,queryFn:async()=>(await createClient().rpc("service_incident",{p_service:serviceId})).data});
  const formId = React.useId();
  const formNode = React.useRef<HTMLFormElement>(null);
  const [formVisible, setFormVisible] = React.useState(false);
  React.useEffect(() => {
    if (!formNode.current) return;
    const observer = new IntersectionObserver(([entry]) => setFormVisible(entry.isIntersecting), { rootMargin: "0px 0px -100px 0px" });
    observer.observe(formNode.current);
    return () => observer.disconnect();
  }, []);
  const router = useRouter();
  const queryClient = useQueryClient();
  const reduced = useReducedMotion();
  const [loading, setLoading] = React.useState(false);
  const submittingRef = React.useRef(false);
  const [quote, setQuote] = React.useState<{ key: string; price: number } | null>(null);
  const [conflicts, setConflicts] = React.useState<UrlConflict[] | null>(null);
  const [pendingValues, setPendingValues] = React.useState<z.infer<typeof formSchema> | null>(null);
  const [confirmValues, setConfirmValues] = React.useState<z.infer<typeof formSchema> | null>(null);

  const firstBillableQuantity = Math.max(minQuantity, Math.ceil(5 / pricePerUnit));
  const suggested = firstBillableQuantity <= maxQuantity ? firstBillableQuantity : minQuantity;
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema.superRefine((values, ctx) => {
      if (values.quantity < minQuantity || values.quantity > maxQuantity) {
        ctx.addIssue({ code: "custom", path: ["quantity"], message: t("Quantity range") + ": " + minQuantity + " – " + maxQuantity });
      }
      const message = targetLinkError(values.link,platform,serviceType);
      if (message) ctx.addIssue({ code: "custom", path: ["link"], message: t(message) });
    })),
    mode: "onBlur",
    defaultValues: { quantity: Math.max(minQuantity, Math.min(maxQuantity, previous?.quantity ?? suggested)), link: previous?.link ?? "", coupon: "" },
  });

  const storageKey="checkout:"+userId+":"+serviceId;
  const [name,setName]=React.useState("");
  const [keyboardInset,setKeyboardInset]=React.useState(0);
  React.useEffect(()=>{
    const viewport=window.visualViewport;
    if(!viewport)return;
    function measure(){
      if(viewport)setKeyboardInset(Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop));
    }
    measure();
    viewport.addEventListener("resize",measure);
    viewport.addEventListener("scroll",measure);
    return ()=>{viewport.removeEventListener("resize",measure);viewport.removeEventListener("scroll",measure);};
  },[]);
  const [templates,setTemplates]=React.useState<{name:string;quantity:number;link:string}[]>([]);
  const [retryCheck,checkAgain]=React.useState(0);
  const [recovering,setRecovering]=React.useState(false);
  React.useEffect(()=>{
    if(!userId)return;
    try{
      const draft=JSON.parse(sessionStorage.getItem(storageKey)||"null");
      if(draft&&!previous)form.reset(draft);
      setTemplates(JSON.parse(localStorage.getItem(storageKey+":templates")||"[]"));
    }catch{}
    const sub=form.watch(v=>{try{sessionStorage.setItem(storageKey,JSON.stringify(v));}catch{}});
    return ()=>sub.unsubscribe();
  },[form,userId,previous,storageKey]);
  React.useEffect(()=>{
    let active=true;
    async function recover(){
      const saved=sessionStorage.getItem(storageKey+":attempt");
      if(!saved)return;
      setRecovering(true);
      try{
        const {key,signature}=JSON.parse(saved),[link,qty,coupon]=JSON.parse(signature);
        const id=await lookupCheckout(key,serviceId,qty,link,coupon);
        if(id&&active){sessionStorage.removeItem(storageKey+":attempt");sessionStorage.removeItem(storageKey);router.replace("/orders/"+id);}
      }catch{}finally{if(active)setRecovering(false);}
    }
    void recover();return()=>{active=false;};
  },[serviceId,storageKey,router,retryCheck]);
  const quantity = form.watch("quantity") || 0;
  // pricePerUnit is per 1000 units, so the total is (price/1000) x quantity.
  const coupon = form.watch("coupon")?.trim() || "";
  const quoteKey = JSON.stringify([serviceId, quantity, coupon]);
  const applied = !!coupon && quote?.key === quoteKey;
  const needsQuote = !!coupon && !applied;
  const usd = applied ? quote.price : computeOrderCharge(pricePerUnit, quantity);
  const total = walletCharge(usd, currency);
  const [couponError,setCouponError] = React.useState("");
  React.useEffect(() => {
    let active=true;
    setCouponError("");
    if (!coupon || quantity<minQuantity || quantity>maxQuantity) return;
    const timer=setTimeout(async()=>{
      try {
        const result=await quoteCouponAction(serviceId,quantity,coupon);
        if(!active)return;
        if(result.success && result.data!=null)setQuote({key:quoteKey,price:result.data});
        else setCouponError(result.error || "Coupon unavailable");
      } catch {if(active)setCouponError("Coupon unavailable");}
    },650);
    return ()=>{active=false;clearTimeout(timer);};
  },[serviceId,coupon,quantity,quoteKey,minQuantity,maxQuantity]);
  const balanceAfter = Math.max(0, Number(balance) - total);

  const presets = React.useMemo(() => {
    const candidates = [suggested, 1000, 5000, 10000, 50000];
    const unique = Array.from(new Set(candidates)).filter(
      (n) => n >= minQuantity && n <= maxQuantity
    );
    return unique.slice(0, 4);
  }, [minQuantity, maxQuantity, suggested]);

  async function placeOrder(values: z.infer<typeof formSchema>) {
    if (needsQuote || !hasSufficientBalance(balance, total)) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    try {
      const signature=JSON.stringify([values.link,Number(values.quantity),values.coupon||""]);
      const last=JSON.parse(sessionStorage.getItem(storageKey+":attempt")||"null");
      const key=last?.signature===signature?last.key:crypto.randomUUID();
      sessionStorage.setItem(storageKey+":attempt",JSON.stringify({key,signature}));
      const result = await createOrderAction({requestId:key,
        serviceId,
        quantity: values.quantity,
        link: values.link,
        coupon: values.coupon,
        expectedUsd: usd,
      });
      if (result.success && result.data) {
        toast.success(t("Order recorded")+" #"+result.data.orderNumber);
        setQuote(null);
        form.setValue("coupon", "");
        sessionStorage.removeItem(storageKey);sessionStorage.removeItem(storageKey+":attempt");
        setConflicts(null);
        setPendingValues(null);
        setConfirmValues(null);
        queryClient.invalidateQueries({ queryKey: ["profile-balance"] });
        router.push(`/orders/${result.data.orderId}`);
        router.refresh();
      } else {
        setQuote(null);
        toast.error(result.error ?? "Failed to place order");
      }
    } catch {checkAgain(v=>v+1);toast.error(t("Connection interrupted. Retry to check the result."));
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (needsQuote || !hasSufficientBalance(balance, total)) return;
    if (submittingRef.current) return;
    setLoading(true);
    try {
      const check = await checkUrlConflictAction({ link: values.link, serviceId });
      if(!check.success){toast.error(t("Could not check active orders"));return;}
      const found = check.success ? (check.data?.conflicts ?? []) : [];
      if (found.length > 0) {
        setPendingValues(values);
        setConflicts(found);
        return;
      }
      setConfirmValues(values);
    } finally {
      setLoading(false);
    }
  }

  const chargeable = Number.isFinite(total) && total > 0;
  const insufficient = chargeable && !hasSufficientBalance(balance, total);
  const canIncrease = !applied && pricePerUnit > 0 && quantity < firstBillableQuantity && firstBillableQuantity <= maxQuantity;

  const reviewLabel = t(needsQuote ? "Apply coupon to review" : !chargeable ? "Review pricing" : insufficient ? "Insufficient Balance" : "Review Order");
  const reviewDisabled = recovering || loading || !chargeable || insufficient || needsQuote;

  function adjustQuantity(delta: number) {
    const current = Number(form.getValues("quantity")) || minQuantity;
    const next = Math.min(maxQuantity, Math.max(minQuantity, current + delta));
    form.setValue("quantity", next, { shouldValidate: true });
  }

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card min-w-0 rounded-xl p-4 sm:p-6"
    >
      <div className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <ShoppingCart className="h-5 w-5 text-primary" /> <CustomerText value="Place Order" />
          </h2>
          {providerServiceId && <Badge variant="secondary">{t("Service ID")} #{providerServiceId}</Badge>}
        </div>
        <p className="mt-2 break-words text-sm text-muted-foreground">{serviceName}</p>
      </div>

      {previous && previous.quantity !== form.formState.defaultValues?.quantity && (
        <p className="mb-3 text-sm text-muted-foreground"><CustomerText value="The service limits changed. Check the adjusted quantity before placing this order." /></p>
      )}
      {incident&&<p role="status" className="mb-3 rounded border p-3">{t(incident)}</p>}
      <details className="mb-3 rounded border p-3 text-sm"><summary>{t("Order templates")}</summary>
        <Input aria-label={t("Template name")} placeholder={t("Template name")} value={name} maxLength={60} onChange={e=>setName(e.target.value)}/>
        <Button type="button" variant="outline" disabled={!name.trim()||!form.watch("link")} onClick={()=>{
          const next=[{name:name.trim(),quantity:Number(form.getValues("quantity")),link:form.getValues("link")},...templates.filter(v=>v.name!==name.trim())].slice(0,20);
          localStorage.setItem(storageKey+":templates",JSON.stringify(next));setTemplates(next);setName("");
        }}>{t("Save template")}</Button>{templates.map(v=><Button type="button" variant="ghost" key={v.name} onClick={()=>form.reset({link:v.link,quantity:v.quantity,coupon:""})}>{v.name}</Button>)}</details>
      <Form {...form}>
        <form noValidate id={formId} ref={formNode} onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pb-16 [&_input]:scroll-mb-36 lg:pb-0">
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel><CustomerText value="Quantity" /></FormLabel>
                  <span className="text-[11px] text-muted-foreground">
                    {minQuantity.toLocaleString()} – {maxQuantity.toLocaleString()}
                  </span>
                </div>
                <FormControl>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 shrink-0"
                      onClick={() => adjustQuantity(-100)}
                      aria-label="Decrease quantity"
                      disabled={Number(field.value) <= minQuantity}
                    >
                      <Minus />
                    </Button>
                    <Input
                      type="number"
                      min={minQuantity}
                      max={maxQuantity}
                      placeholder="1000"
                      className="text-center tabular-nums"
                      {...field}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 shrink-0"
                      onClick={() => adjustQuantity(100)}
                      aria-label="Increase quantity"
                      disabled={Number(field.value) >= maxQuantity}
                    >
                      <Plus />
                    </Button>
                  </div>
                </FormControl>
                {presets.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {presets.map((preset) => {
                      const active = Number(field.value) === preset;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => form.setValue("quantity", preset, { shouldValidate: true })}
                          className={
                            "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors " +
                            (active
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground")
                          }
                        >
                          {preset.toLocaleString()}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-2 rounded-xl border bg-muted/40 p-3 text-sm">
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">{t("Rate (per 1k)")}</span><span className="tabular-nums">{formatUsd(pricePerUnit, 4)}</span></div>
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">{t("Refill")}</span><span className="text-right">{t(refillLabel)}</span></div>
            {applied && <div className="mt-1.5 flex justify-between text-sm text-success"><span><CustomerText value="Coupon discount" /></span><span>−{formatCurrency(walletCharge(computeOrderCharge(pricePerUnit, quantity), currency) - total, currency)}</span></div>}
            {averageTime && <div className="flex justify-between gap-3"><span className="text-muted-foreground">{t("Est. delivery")}</span><span>{averageTime}</span></div>}
            <p className="text-xs">{t("Before rounding")} · {formatUsd(pricePerUnit*quantity/1000,6)}</p>
            <p className="text-xs">{formatUsd(usd)} · {formatCurrency(walletCharge(usd,"BDT"),"BDT")}</p>
            <div className="mt-2.5 flex items-center justify-between border-t pt-2.5">
              <span className="font-medium"><CustomerText value="Wallet charge" /></span>
              <span className="text-xl font-bold text-primary tabular-nums">
                {Number.isFinite(total) ? formatCurrency(total, currency) : "Unavailable"}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground"><CustomerText value="Balance after order" /></span>
              <span className={insufficient ? "font-semibold text-destructive" : "font-semibold text-success"}>
                {Number.isFinite(balanceAfter) ? formatCurrency(balanceAfter, currency) : "Unavailable"}
              </span>
            </div>
          </div>

          {!chargeable && !needsQuote && (
            <div role="status" className="space-y-2 rounded-lg border p-3 text-sm">
              <p>{t(!Number.isFinite(total) ? "No exchange rate is configured for your wallet currency."
                : canIncrease ? "This quantity rounds to a $0.00 order. Increase the quantity to get a payable total."
                : "This order has no payable total. Check the quantity, service or coupon.")}</p>
              {canIncrease && Number.isFinite(total) && (
                <Button type="button" size="sm" variant="outline" onClick={() => form.setValue("quantity", firstBillableQuantity, { shouldValidate: true })}>
                  <CustomerText value="Use quantity" /> {firstBillableQuantity.toLocaleString()}
                </Button>
              )}
            </div>
          )}
          {insufficient && !needsQuote ? (
            <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div className="space-y-1">
                  <p className="font-semibold text-destructive">
                    <CustomerText value="Insufficient balance. Please add funds to place this order." />
                  </p>
                  <p className="text-muted-foreground">
                    <CustomerText value="Required:" /> {Number.isFinite(total) ? formatCurrency(total, currency) : "Unavailable"} · {t("Current balance")}: {formatCurrency(balance, currency)}
                  </p>
                </div>
              </div>
              <Button asChild variant="gradient" size="sm" className="w-full">
                <a href={"/add-funds?bdt="+Math.ceil((total-balance)*(currency==="USD"?126:1))}>
                  <Wallet /> <CustomerText value="Add Funds" /> · {formatCurrency(total-balance,currency)}
                </a>
              </Button>
            </div>
          ) : null}

          <FormField
            control={form.control}
            name="link"
            render={({ field }) => (
              <FormItem>
                <FormLabel><CustomerText value="Target Link" /></FormLabel>
                <FormControl>
                  <div className="relative">
                    <Link2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder={t("Paste your target link")}
                      {...field}
                    />
                  </div>
                </FormControl>
                <p className="break-all text-xs text-muted-foreground">{t("Example link")}: {linkPlaceholder}</p>
                <FormMessage />
              </FormItem>
            )}
          />

          <details className="rounded-lg border px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium">{t("Coupon (optional)")}{applied && " ✓"}</summary>
            <FormField
              control={form.control}
              name="coupon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">{t("Discount code")}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Tag className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder={t("Discount code")}
                        className="pl-9"
                        onChange={(e) => {
                          field.onChange(e);
                          setQuote(null);
                        }}
                        value={field.value}
                        onBlur={field.onBlur}
                        name={field.name}
                      />
                    </div>
                  </FormControl>
                  {coupon && (
                    <p role="status" className="text-sm">{t(applied?"Coupon applied":couponError||"Checking coupon")} · {serviceName}</p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          </details>
          <Button type="submit" variant="gradient" className={formVisible ? "hidden w-full lg:inline-flex" : "w-full"} disabled={reviewDisabled}>
            {loading ? <Loader2 className="animate-spin" /> : <Zap />}
            {reviewLabel}
          </Button>

        </form>
      </Form>

      {formVisible && !confirmValues && !conflicts && createPortal(
        <div style={keyboardInset>80 ? {bottom:keyboardInset}:undefined} className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-[45] flex items-center justify-between gap-3 border-t bg-background px-4 py-2 shadow-sm lg:hidden">
          <div className="shrink-0"><p className="text-xs text-muted-foreground">{t("Total charge")}</p>
            <p className="font-semibold tabular-nums">{Number.isFinite(total) ? formatCurrency(total, currency) : t("Unavailable")}</p></div>
          <Button className="min-w-0 whitespace-normal text-center" variant="gradient" type="submit" form={formId} disabled={reviewDisabled}>{reviewLabel}</Button>
        </div>, document.body)}
      {/* Duplicate URL warning */}
      <Dialog open={!!conflicts} onOpenChange={(open) => !open && setConflicts(null)}>
        <DialogContent className="grid-cols-1 w-[calc(100%_-_1rem)] max-h-[90dvh] min-w-0 overflow-x-hidden p-4 [overflow-wrap:anywhere] sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <CustomerText value="Duplicate URL warning" />
            </DialogTitle>
            <DialogDescription>
              <CustomerText value="This link already has an active order. Continuing may overlap delivery. Confirm only if this is intentional." />
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {(conflicts ?? []).map((c) => (
              <div key={c.orderId} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <a className="text-primary underline" href={"/orders/"+c.orderId}>#{c.orderNumber}</a>
                  <Badge variant="warning">{c.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.serviceName ?? "Service"} · Qty {c.quantity.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConflicts(null); setPendingValues(null); }}>
              <CustomerText value="Cancel" />
            </Button>
            <Button
              variant="gradient"
              disabled={!pendingValues}
              onClick={() => {
                setConfirmValues(pendingValues);
                setConflicts(null);
              }}
            >
              <CustomerText value="Continue anyway" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order confirmation */}
      <Dialog open={!!confirmValues} onOpenChange={(open) => !open && !loading && setConfirmValues(null)}>
        <DialogContent className="grid-cols-1 w-[calc(100%_-_1rem)] max-h-[90dvh] min-w-0 overflow-x-hidden p-4 [overflow-wrap:anywhere] sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <CustomerText value="Confirm your order" />
            </DialogTitle>
            <DialogDescription>
              <CustomerText value="Review the details below. Your wallet is charged immediately after confirming." />
            </DialogDescription>
          </DialogHeader>
          {confirmValues ? (
            <div className="space-y-2 text-sm">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground"><CustomerText value="Service" /></p>
                <p className="mt-0.5 break-words font-medium">{serviceName}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground"><CustomerText value="Quantity" /></p>
                  <p className="mt-0.5 font-semibold tabular-nums">
                    {confirmValues.quantity.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground"><CustomerText value="Total charge" /></p>
                  <p className="mt-0.5 font-semibold text-primary tabular-nums">
                    {Number.isFinite(total) ? formatCurrency(total, currency) : "Unavailable"}
                  </p>
                </div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground"><CustomerText value="Target link" /></p>
                <p className="mt-0.5 break-all font-mono text-xs">{confirmValues.link}</p>
              </div>
              {averageTime ? (
                <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" /> <CustomerText value="Estimated delivery" />
                  </span>
                  <span className="text-xs font-medium">{averageTime}</span>
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmValues(null)}
              disabled={loading}
            >
              <CustomerText value="Back" />
            </Button>
            <Button
              variant="gradient"
              disabled={loading || !confirmValues}
              onClick={() => confirmValues && placeOrder(confirmValues)}
            >
              {loading ? <Loader2 className="animate-spin" /> : <Zap />}
              <CustomerText value="Confirm & Place Order" /> · {formatCurrency(total,currency)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

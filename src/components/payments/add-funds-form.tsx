"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Loader2,
  Upload,
  Wallet,
  Smartphone,
  Hash,
  MessageSquare,
  ImagePlus,
  CheckCircle2,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { submitPaymentAction } from "@/lib/actions/payments";
import type { PaymentSettings } from "@/lib/types/app";
import { BKashLogo, NagadLogo, RocketLogo } from "./brand-logos";

const formSchema = z.object({
  method: z.enum(["bKash", "nagad", "rocket"]),
  senderNumber: z.string().min(10, "Enter your sender number").max(20),
  amount: z.coerce.number().positive("Amount must be positive").max(100000),
  transactionId: z.string().min(4, "Enter the transaction ID").max(100),
  note: z.string().max(500).optional().or(z.literal("")),
});

const allMethods = [
  {
    key: "bKash" as const,
    label: "bKash",
    accent: "#e2136e",
    Logo: BKashLogo,
  },
  { key: "nagad" as const, label: "Nagad", accent: "#ed1c24", Logo: NagadLogo },
  { key: "rocket" as const, label: "Rocket", accent: "#54a3da", Logo: RocketLogo },
];

export function AddFundsForm({
  payments,
  currency,
}: {
  payments: PaymentSettings;
  currency: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [screenshot, setScreenshot] = React.useState<{
    data: string;
    type: string;
    size: number;
  } | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const enabledKeys = new Set(
    payments.enabled?.length ? payments.enabled : ["bKash", "nagad", "rocket"]
  );
  const methods = allMethods.filter((m) => enabledKeys.has(m.key));
  const defaultMethod = methods[0]?.key ?? "bKash";

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { method: defaultMethod, senderNumber: "", amount: undefined as unknown as number, transactionId: "", note: "" },
  });

  const method = form.watch("method");
  const methodNumber = payments[method] ?? "";
  const activeMethod = methods.find((m) => m.key === method) ?? methods[0]!;
  const [copied, setCopied] = React.useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(methodNumber);
      setCopied(true);
      toast.success(`${activeMethod.label} number copied`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy the number. Please copy it manually.");
    }
  }

  if (methods.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-xl p-6"
      >
        <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
          <Wallet className="h-5 w-5 text-primary" /> Make a Deposit
        </h2>
        <p className="mb-5 text-sm text-muted-foreground">
          Send money to the number below, then fill in the form with your details.
        </p>
        <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
          No payment methods are currently available. Please contact support.
        </div>
      </motion.div>
    );
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Screenshot must be smaller than 5MB.");
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
      toast.error("Screenshot must be an image (PNG, JPEG, WEBP, GIF).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result as string;
      setScreenshot({ data, type: file.type, size: file.size });
      setPreview(data);
    };
    reader.readAsDataURL(file);
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!screenshot) {
      toast.error("Please upload a payment screenshot.");
      return;
    }
    setLoading(true);
    try {
      const result = await submitPaymentAction({
        method: values.method,
        senderNumber: values.senderNumber,
        amount: values.amount,
        transactionId: values.transactionId,
        note: values.note,
        screenshot: screenshot.data,
        screenshotType: screenshot.type,
        screenshotSize: screenshot.size,
      });
      if (result.success) {
        toast.success("Payment request submitted! Awaiting approval.");
        form.reset({ method: defaultMethod, senderNumber: "", amount: undefined as unknown as number, transactionId: "", note: "" });
        setScreenshot(null);
        setPreview(null);
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to submit payment request");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-xl p-6"
    >
      <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
        <Wallet className="h-5 w-5 text-primary" /> Make a Deposit
      </h2>
      <p className="mb-5 text-sm text-muted-foreground">
        Send money to the number below, then fill in the form with your details.
      </p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="method"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Method</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value}
                    className="grid grid-cols-3 gap-2"
                  >
                    {methods.map((m) => {
                      const checked = field.value === m.key;
                      return (
                        <div key={m.key}>
                          <RadioGroupItem
                            value={m.key}
                            id={`method-${m.key}`}
                            className="peer sr-only"
                          />
                          <label
                            htmlFor={`method-${m.key}`}
                            className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-3 text-sm font-medium transition-all hover:bg-muted/40"
                            style={{
                              borderColor: checked ? m.accent : undefined,
                              backgroundColor: checked
                                ? `${m.accent}14`
                                : undefined,
                              boxShadow: checked
                                ? `0 0 0 1px ${m.accent}`
                                : undefined,
                            }}
                          >
                            <span className="flex h-9 w-full items-center justify-center">
                              <m.Logo className="h-5 w-auto max-w-full" />
                            </span>
                            <span>{m.label}</span>
                          </label>
                        </div>
                      );
                    })}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {methodNumber ? (
            <div
              className="rounded-xl border p-4"
              style={{ borderColor: `${activeMethod.accent}4d` }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="flex h-8 shrink-0 items-center rounded-md px-2.5"
                    style={{ backgroundColor: `${activeMethod.accent}1a` }}
                  >
                    <activeMethod.Logo className="h-5 w-auto" />
                  </span>
                  <p className="truncate text-xs text-muted-foreground">
                    Send money to this {activeMethod.label} number
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="shrink-0 gap-1.5"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p
                className="mt-3 select-all text-3xl font-extrabold tracking-tight md:text-4xl"
                style={{ color: activeMethod.accent }}
              >
                {methodNumber}
              </p>
            </div>
          ) : (
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              No {method} number configured yet. Contact support for payment details.
            </div>
          )}

          <FormField
            control={form.control}
            name="senderNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sender Number</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Smartphone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="01XXXXXXXXX" className="pl-9" {...field} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount ({currency})</FormLabel>
                <FormControl>
                  <Input type="number" min={1} placeholder="500" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="transactionId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Transaction ID</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Hash className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="e.g. 8X2H9K1L5M" className="pl-9" {...field} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="note"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Note (optional)</FormLabel>
                <FormControl>
                  <div className="relative">
                    <MessageSquare className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Textarea placeholder="Anything we should know?" className="pl-9" {...field} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Screenshot */}
          <div>
            <Label>Screenshot Proof</Label>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={onFileChange}
            />
            {preview ? (
              <div className="relative mt-2 overflow-hidden rounded-lg border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Payment screenshot preview" className="max-h-52 w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 p-2">
                  <span className="flex items-center gap-1 text-xs text-white">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" /> Screenshot attached
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-white hover:bg-white/20"
                    onClick={() => {
                      setScreenshot(null);
                      setPreview(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-2 flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <ImagePlus className="h-6 w-6" />
                Click to upload screenshot (PNG/JPG/WEBP, max 5MB)
              </button>
            )}
          </div>

          <Button type="submit" variant="gradient" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <Upload />}
            Submit Payment Request
          </Button>
        </form>
      </Form>
    </motion.div>
  );
}

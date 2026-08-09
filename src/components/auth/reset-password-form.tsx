"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowLeft, KeyRound, Loader2, Lock } from "lucide-react";
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
import { resetPasswordAction } from "@/lib/actions/auth";

const formSchema = z
  .object({
    password: z
      .string()
      .min(8, "At least 8 characters")
      .regex(/[a-z]/, "Lowercase letter required")
      .regex(/[A-Z]/, "Uppercase letter required")
      .regex(/[0-9]/, "Number required"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

function ResetPasswordFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const [loading, setLoading] = React.useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  React.useEffect(() => {
    if (!code) {
      toast.error("This reset link is invalid or expired.");
    }
  }, [code]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!code) {
      toast.error("Missing reset code.");
      return;
    }
    setLoading(true);
    try {
      const result = await resetPasswordAction({ password: values.password, code });
      if (result.success) {
        toast.success("Password updated. You can now sign in.");
        router.push("/login");
      } else {
        toast.error(result.error ?? "Failed to reset password");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      <div className="space-y-1.5 text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full gradient-bg text-white shadow-lg">
          <KeyRound className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold">Set a new password</h1>
        <p className="text-sm text-muted-foreground">
          Choose a strong, new password for your account.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="At least 8 characters"
                      className="pl-9"
                      type="password"
                      autoComplete="new-password"
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm New Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Repeat your password"
                      className="pl-9"
                      type="password"
                      autoComplete="new-password"
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <KeyRound />}
            Update Password
          </Button>
        </form>
      </Form>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
      </p>
    </motion.div>
  );
}

export function ResetPasswordForm() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-muted-foreground">Loading...</div>}>
      <ResetPasswordFormInner />
    </Suspense>
  );
}

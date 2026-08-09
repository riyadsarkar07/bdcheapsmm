"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowLeft, KeyRound, Loader2, Mail } from "lucide-react";
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
import { forgotPasswordAction } from "@/lib/actions/auth";

const formSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

export function ForgotPasswordForm() {
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    try {
      const result = await forgotPasswordAction(values);
      if (result.success) {
        setSent(true);
        toast.success("Reset link sent. Check your email.");
      } else {
        toast.error(result.error ?? "Something went wrong");
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
        <h1 className="text-2xl font-bold">Forgot password?</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      {sent ? (
        <div className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            If an account exists for that email, a password reset link has been
            sent. Check your inbox (and spam folder).
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">
              <ArrowLeft /> Back to sign in
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="you@example.com"
                          className="pl-9"
                          type="email"
                          autoComplete="email"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <Mail />}
                Send Reset Link
              </Button>
            </form>
          </Form>
          <p className="text-center text-sm text-muted-foreground">
            Remembered it?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Back to sign in
            </Link>
          </p>
        </>
      )}
    </motion.div>
  );
}

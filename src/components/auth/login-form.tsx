"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, LogIn, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { signInAction, signInWithGoogleAction } from "@/lib/actions/auth";

const formSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  remember: z.boolean().default(true),
});

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);

  React.useEffect(() => {
    const error = searchParams.get("error");
    const verification = searchParams.get("verification");
    if (error) toast.error("Sign in failed. Please try again.");
    if (verification) toast.info("Please verify your email before signing in.");
  }, [searchParams]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "", remember: true },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    try {
      const result = await signInAction(values);
      if (result.success) {
        toast.success("Signed in successfully.");
        router.push(result.data?.redirect ?? "/dashboard");
        router.refresh();
      } else {
        toast.error(result.error ?? "Sign in failed");
      }
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogleAction();
      if (result.success && result.data) {
        window.location.href = (result.data as { redirect: string }).redirect;
      } else {
        toast.error(result.error ?? "Google sign-in failed");
      }
    } finally {
      setGoogleLoading(false);
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
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to access your SMM panel
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={onGoogle}
        disabled={googleLoading}
      >
        {googleLoading ? (
          <Loader2 className="animate-spin" />
        ) : (
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"
            />
          </svg>
        )}
        Continue with Google
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">or</span>
        </div>
      </div>

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
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="••••••••"
                      className="pl-9 pr-9"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input accent-primary"
                checked={form.watch("remember")}
                onChange={(e) => form.setValue("remember", e.target.checked)}
              />
              <span className="text-muted-foreground">Remember me</span>
            </label>
            <Link
              href="/forgot-password"
              className="text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <LogIn />}
            Sign In
          </Button>
        </form>
      </Form>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Create one
        </Link>
      </p>
    </motion.div>
  );
}

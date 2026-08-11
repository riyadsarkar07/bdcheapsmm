"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signInSchema, signUpSchema, forgotPasswordSchema, resetPasswordSchema } from "@/lib/validations";
import { fail, ok, isAdminProfile, type ActionResult } from "@/lib/guards";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { writeLog } from "@/lib/audit";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function signInAction(input: {
  email: string;
  password: string;
  remember: boolean;
}): Promise<ActionResult<{ redirect: string }>> {
  const headerStore = await headers();
  const ip = getClientIp(headerStore);
  const limited = await rateLimit(`login:${ip}`, 10, 60);
  if (!limited.success) {
    return fail("Too many login attempts. Please try again later.");
  }

  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return fail(error.message);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profile?.status === "banned") {
    await supabase.auth.signOut();
    return fail("Your account has been suspended. Contact support.");
  }

  const target = profile && isAdminProfile(profile) ? "/admin" : "/dashboard";
  await writeLog({
    userId: data.user.id,
    action: "login",
    ip,
    userAgent: headerStore.get("user-agent"),
  });

  return ok({ redirect: target });
}

export async function signUpAction(input: {
  fullName: string;
  email: string;
  password: string;
}): Promise<ActionResult<{ redirect: string }>> {
  const headerStore = await headers();
  const ip = getClientIp(headerStore);
  const limited = await rateLimit(`signup:${ip}`, 5, 3600);
  if (!limited.success) {
    return fail("Too many signup attempts. Please try again later.");
  }

  const parsed = signUpSchema.safeParse({ ...input, confirmPassword: input.password });
  if (!parsed.success) {
    return fail(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
      },
      emailRedirectTo: `${APP_URL}/auth/callback`,
    },
  });

  if (error) {
    return fail(error.message);
  }

  return ok({ redirect: "/login?verification=1" });
}

export async function signInWithGoogleAction(): Promise<ActionResult> {
  const headerStore = await headers();
  const ip = getClientIp(headerStore);
  const limited = await rateLimit(`google:${ip}`, 10, 60);
  if (!limited.success) {
    return fail("Too many attempts. Please try again later.");
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${APP_URL}/auth/callback`,
    },
  });

  if (error) {
    return fail(error.message);
  }
  if (!data.url) {
    return fail("Could not start Google sign-in.");
  }
  return ok({ redirect: data.url } as unknown as never);
}

export async function signInWithOtpAction(input: {
  email: string;
}): Promise<ActionResult> {
  const headerStore = await headers();
  const ip = getClientIp(headerStore);
  const limited = await rateLimit(`otp:${ip}`, 5, 60);
  if (!limited.success) {
    return fail("Too many requests. Please try again later.");
  }

  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.errors[0]?.message ?? "Invalid email");
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${APP_URL}/auth/callback`,
    },
  });

  if (error) {
    return fail(error.message);
  }
  return ok(undefined, "Magic link sent. Check your email.");
}

export async function forgotPasswordAction(input: {
  email: string;
}): Promise<ActionResult> {
  const headerStore = await headers();
  const ip = getClientIp(headerStore);
  const limited = await rateLimit(`forgot:${ip}`, 5, 3600);
  if (!limited.success) {
    return fail("Too many requests. Please try again later.");
  }

  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.errors[0]?.message ?? "Invalid email");
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${APP_URL}/reset-password`,
  });

  if (error) {
    return fail(error.message);
  }
  return ok(undefined, "If that email exists, a reset link has been sent.");
}

export async function resetPasswordAction(input: {
  password: string;
  code: string;
}): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    password: input.password,
    confirmPassword: input.password,
  });
  if (!parsed.success) {
    return fail(parsed.error.errors[0]?.message ?? "Invalid password");
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: sessionData } = await supabase.auth.exchangeCodeForSession(input.code);
  if (!sessionData.session) {
    return fail("Invalid or expired reset link. Please request a new one.");
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return fail(error.message);
  }
  return ok(undefined, "Password updated. You can now sign in.");
}

export async function signOutAction(): Promise<void> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function resendVerificationAction(input: { email: string }): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid email");

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: `${APP_URL}/auth/callback` },
  });
  if (error) return fail(error.message);
  return ok(undefined, "Verification email sent.");
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Loader2, Save, Camera, User } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  updateProfileAction,
  uploadAvatarAction,
} from "@/lib/actions/profile";
import { getInitials, formatCurrency } from "@/lib/utils";
import type { Profile } from "@/lib/types/database";

const formSchema = z.object({
  fullName: z.string().min(2, "Full name is required").max(100),
  phone: z.string().max(20).optional().or(z.literal("")),
  country: z.string().max(100).optional().or(z.literal("")),
  currency: z.string().default("BDT"),
  timezone: z.string().default("Asia/Dhaka"),
});

const timezones = [
  "Asia/Dhaka",
  "Asia/Kolkata",
  "Asia/Karachi",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "UTC",
];

export function ProfileSettings({ user }: { user: Profile }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [avatarLoading, setAvatarLoading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: user.full_name ?? "",
      phone: user.phone ?? "",
      country: user.country ?? "",
      currency: user.currency,
      timezone: user.timezone,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    try {
      const result = await updateProfileAction(values);
      if (result.success) {
        toast.success("Profile updated");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to update");
      }
    } finally {
      setLoading(false);
    }
  }

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Avatar must be smaller than 2MB.");
      return;
    }
    setAvatarLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const result = await uploadAvatarAction({
          data: reader.result as string,
          type: file.type,
          size: file.size,
        });
        if (result.success) {
          toast.success("Avatar updated");
          router.refresh();
        } else {
          toast.error(result.error ?? "Failed to upload avatar");
        }
        setAvatarLoading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setAvatarLoading(false);
      toast.error("Failed to upload avatar");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center text-center">
          <div className="relative">
            <Avatar className="h-24 w-24">
              <AvatarImage src={user.avatar_url ?? undefined} alt={user.full_name ?? ""} />
              <AvatarFallback className="text-2xl">{getInitials(user.full_name)}</AvatarFallback>
            </Avatar>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={avatarLoading}
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full gradient-bg text-white shadow-lg hover:opacity-90 disabled:opacity-50"
              aria-label="Upload avatar"
            >
              {avatarLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onAvatarChange} />
          </div>
          <h3 className="mt-3 font-semibold">{user.full_name || "User"}</h3>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <Separator className="my-4" />
          <div className="w-full space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Role</span>
              <span className="font-medium capitalize">{user.role}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium capitalize">{user.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Balance</span>
              <span className="font-semibold text-primary">
                {formatCurrency(user.balance, user.currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Member since</span>
              <span className="font-medium">
                {new Date(user.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" /> Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="01XXXXXXXXX" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input placeholder="Bangladesh" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <FormControl>
                        <select className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" {...field}>
                          <option value="BDT">BDT (৳)</option>
                          <option value="USD">USD ($)</option>
                          <option value="INR">INR (₹)</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="timezone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timezone</FormLabel>
                      <FormControl>
                        <select className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" {...field}>
                          {timezones.map((tz) => (
                            <option key={tz} value={tz}>{tz}</option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" variant="gradient" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <Save />}
                Save Changes
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

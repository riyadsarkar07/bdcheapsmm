import { z } from "zod";

export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Please enter a valid email address")
  .max(255, "Email is too long");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number");

export const signUpSchema = z.object({
  fullName: z
    .string()
    .min(2, "Full name is required")
    .max(100, "Name is too long"),
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
  remember: z.boolean().default(true),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const updateProfileSchema = z.object({
  fullName: z.string().min(2, "Full name is required").max(100),
  phone: z
    .string()
    .max(20, "Phone number is too long")
    .regex(/^[0-9+\-() ]*$/, "Invalid phone number")
    .optional()
    .or(z.literal("")),
  country: z.string().max(100).optional().or(z.literal("")),
  currency: z.string().default("BDT"),
  timezone: z.string().default("Asia/Dhaka"),
});

export const createOrderSchema = z.object({
  serviceId: z.string().uuid("Invalid service"),
  quantity: z.coerce
    .number()
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1"),
  link: z
    .string()
    .min(5, "Link is required")
    .max(2048, "Link is too long")
    .refine(
      (value) => /^https?:\/\/.+/i.test(value),
      "Please enter a valid URL starting with http:// or https://"
    ),
  coupon: z.string().max(50).optional().or(z.literal("")),
});

export const retryOrderSchema = z.object({
  orderId: z.string().uuid("Invalid order"),
  link: z
    .string()
    .min(5, "Link is required")
    .max(2048, "Link is too long")
    .refine(
      (value) => /^https?:\/\/.+/i.test(value),
      "Please enter a valid URL starting with http:// or https://"
    ),
});

export const addFundsSchema = z.object({
  method: z.enum(["bKash", "nagad", "rocket"], {
    message: "Select a payment method",
  }),
  senderNumber: z
    .string()
    .min(10, "Please enter a valid sender number")
    .max(20, "Sender number is too long"),
  amount: z.coerce
    .number()
    .positive("Amount must be greater than 0")
    .max(100000, "Amount is too large"),
  transactionId: z
    .string()
    .min(4, "Transaction ID is required")
    .max(100, "Transaction ID is too long"),
  note: z.string().max(500).optional().or(z.literal("")),
});

export const createTicketSchema = z.object({
  subject: z.string().min(3, "Subject is required").max(200),
  category: z.string().max(100).optional().or(z.literal("")),
  priority: z.enum(["low", "normal", "high"], { message: "Select priority" }),
  message: z.string().min(5, "Please describe your issue").max(5000),
});

export const replyTicketSchema = z.object({
  message: z.string().min(1, "Message is required").max(5000),
});

export const applyCouponSchema = z.object({
  code: z.string().min(2, "Coupon code is required").max(50),
});

export const adminServiceSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  categoryId: z.string().uuid("Select a category").nullable().optional(),
  providerId: z.string().uuid("Select a provider").nullable().optional(),
  providerServiceId: z.string().max(100).optional().or(z.literal("")),
  description: z.string().max(2000).optional().or(z.literal("")),
  price: z.coerce.number().min(0, "Price cannot be negative"),
  minQuantity: z.coerce.number().int().min(1, "Min must be at least 1"),
  maxQuantity: z.coerce.number().int().min(1, "Max must be at least 1"),
  averageTime: z.string().max(100).optional().or(z.literal("")),
  type: z.string().max(100).optional().or(z.literal("")),
  profitMargin: z.coerce.number().min(-100).max(100).default(0),
  pricingMode: z.enum(["global", "custom"]).default("global"),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
}).refine((data) => data.maxQuantity >= data.minQuantity, {
  message: "Max quantity must be greater than or equal to min quantity",
  path: ["maxQuantity"],
});

export const adminCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers and dashes"),
  description: z.string().max(1000).optional().or(z.literal("")),
  icon: z.string().max(100).optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const adminProviderSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  apiUrl: z
    .string()
    .min(1, "API URL is required")
    .url("Please enter a valid URL")
    .or(z.literal("")),
  apiKey: z.string().max(500).optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]),
  priority: z.coerce.number().int().default(0),
});

export const adminSettingsSchema = z.object({
  siteName: z.string().min(1, "Website name is required").max(100),
  tagline: z.string().max(200).optional().or(z.literal("")),
  logo: z.string().url().optional().or(z.literal("")).nullable(),
  favicon: z.string().url().optional().or(z.literal("")).nullable(),
  currency: z.string().min(1, "Currency is required").max(10).default("BDT"),
  timezone: z.string().min(1, "Timezone is required").max(100),
  maintenanceMode: z.boolean().default(false),
  bKash: z.string().max(30).optional().or(z.literal("")),
  nagad: z.string().max(30).optional().or(z.literal("")),
  rocket: z.string().max(30).optional().or(z.literal("")),
  bKashEnabled: z.boolean().default(true),
  nagadEnabled: z.boolean().default(true),
  rocketEnabled: z.boolean().default(true),
  seoTitle: z.string().max(200).optional().or(z.literal("")),
  seoDescription: z.string().max(500).optional().or(z.literal("")),
  seoKeywords: z.string().max(500).optional().or(z.literal("")),
  footerText: z.string().max(500).optional().or(z.literal("")),
});

export const adminCouponSchema = z.object({
  code: z
    .string()
    .min(2, "Code is required")
    .max(50)
    .transform((value) => value.toUpperCase()),
  discountType: z.enum(["percent", "fixed"]),
  discountValue: z.coerce.number().positive("Discount must be positive"),
  minAmount: z.coerce.number().min(0).default(0).optional(),
  maxDiscount: z.coerce.number().min(0).optional().nullable(),
  usageLimit: z.coerce.number().int().min(0).optional().nullable(),
  perUserLimit: z.coerce.number().int().min(1).default(1),
  startsAt: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const adminUserSchema = z.object({
  fullName: z.string().min(1).max(100),
  phone: z.string().max(20).optional().or(z.literal("")),
  country: z.string().max(100).optional().or(z.literal("")),
  currency: z.string().default("BDT"),
  timezone: z.string().default("Asia/Dhaka"),
  status: z.enum(["active", "banned"]),
  role: z.enum(["admin", "user"]),
});

export const balanceAdjustSchema = z.object({
  amount: z.coerce
    .number()
    .refine((value) => value !== 0, "Amount cannot be zero")
    .refine((value) => Math.abs(value) <= 1000000, "Amount is too large"),
  description: z.string().min(2, "Description is required").max(500),
});

export const apiKeyCreateSchema = z.object({
  name: z.string().min(2, "Name is required").max(100),
  permissions: z.array(z.string()).default([]),
  expiresAt: z.string().optional().nullable(),
});

export const refCodeSchema = z
  .string()
  .max(20, "Invalid referral code")
  .regex(/^[A-Z0-9]+$/, "Invalid referral code")
  .optional()
  .or(z.literal(""));

export const referralSettingsSchema = z.object({
  ratePercent: z.coerce
    .number()
    .min(0, "Rate cannot be negative")
    .max(100, "Rate cannot exceed 100%")
    .refine((v) => v <= 100 && v >= 0, "Rate must be between 0 and 100"),
  enabled: z.boolean().default(true),
});

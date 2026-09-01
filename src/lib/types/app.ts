import type {
  ApiKey,
  Category,
  Coupon,
  Log,
  Notification,
  Order,
  PaymentRequest,
  Profile,
  Provider,
  Service,
  Ticket,
  TicketMessage,
  Transaction,
} from "@/lib/types/database";

export interface ServiceWithCategory extends Service {
  categories?: Pick<Category, "id" | "name" | "slug" | "icon"> | null;
  providers?: Pick<Provider, "id" | "name"> | null;
}

export interface OrderWithService extends Order {
  services?: Pick<Service, "id" | "name" | "slug" | "type"> | null;
  profiles?: Pick<Profile, "id" | "full_name" | "email"> | null;
}

export interface PaymentRequestWithUser extends PaymentRequest {
  profiles?: Pick<Profile, "id" | "full_name" | "email"> | null;
}

export interface TicketWithUser extends Ticket {
  profiles?: Pick<Profile, "id" | "full_name" | "email"> | null;
}

export interface TicketMessageWithUser extends TicketMessage {
  profiles?: Pick<Profile, "id" | "full_name" | "email" | "avatar_url"> | null;
}

export interface TransactionWithUser extends Transaction {
  profiles?: Pick<Profile, "id" | "full_name" | "email"> | null;
}

export interface LogWithUser extends Log {
  profiles?: Pick<Profile, "id" | "full_name" | "email"> | null;
}

export interface ApiKeyWithUser extends ApiKey {
  profiles?: Pick<Profile, "id" | "full_name" | "email"> | null;
}

export interface CouponWithUsage extends Coupon {
  used_by_user?: number;
}

export interface SiteSettings {
  name: string;
  tagline: string;
  logo: string | null;
  favicon: string | null;
}

export interface GeneralSettings {
  currency: string;
  timezone: string;
  maintenance_mode: boolean;
}

export interface PaymentSettings {
  bKash: string;
  nagad: string;
  rocket: string;
  enabled: string[];
}

export interface SeoSettings {
  title: string;
  description: string;
  keywords: string;
}

export interface FooterSettings {
  text: string;
  links: { label: string; href: string }[];
}

export interface ReferralSettings {
  rate_percent: number;
  enabled: boolean;
}

export const DEFAULT_REFERRAL_SETTINGS: ReferralSettings = {
  rate_percent: 5,
  enabled: true,
};

export interface PublicSettings {
  site: SiteSettings;
  general: GeneralSettings;
  payments: PaymentSettings;
  seo: SeoSettings;
  footer: FooterSettings;
}

export interface DashboardStats {
  balance: number;
  todayOrders: number;
  pendingOrders: number;
  processingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalOrders: number;
  totalSpent: number;
  recentOrders: OrderWithService[];
}

export interface AdminDashboardStats {
  totalUsers: number;
  newUsersToday: number;
  totalOrders: number;
  ordersToday: number;
  ordersPending: number;
  ordersProcessing: number;
  ordersCompleted: number;
  ordersCancelled: number;
  revenue: number;
  depositsPending: number;
  depositsApproved: number;
  openTickets: number;
  activeServices: number;
  activeProviders: number;
  recentOrders: OrderWithService[];
  recentPayments: PaymentRequestWithUser[];
  recentUsers: Profile[];
}

export type { Service, Order, Provider, Category, Coupon, ApiKey, Log, Notification, Ticket, TicketMessage, Transaction, PaymentRequest, Profile };

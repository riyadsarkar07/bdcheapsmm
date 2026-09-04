export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AppRole = "admin" | "user";
export type UserStatus = "active" | "banned";
export type OrderStatus =
  | "pending"
  | "processing"
  | "in_progress"
  | "completed"
  | "partial"
  | "cancelled"
  | "refunded"
  | "failed"
  | "rejected";
export type PaymentStatus = "pending" | "approved" | "rejected";
export type TicketStatus = "open" | "waiting" | "closed";
export type TransactionType =
  | "deposit"
  | "order_deduction"
  | "refund"
  | "adjustment"
  | "referral_commission"
  | "login_reward";
export type ProviderStatus = "active" | "inactive";
export type NotificationType =
  | "payment_approved"
  | "payment_rejected"
  | "order_completed"
  | "order_cancelled"
  | "system_announcement"
  | "ticket_reply"
  | "order_status"
  | "referral_commission"
  | "security_alert";
export type LogAction =
  | "create"
  | "update"
  | "delete"
  | "approve"
  | "reject"
  | "login"
  | "logout"
  | "order_create"
  | "order_cancel"
  | "order_refill"
  | "order_retry"
  | "provider_sync"
  | "service_import"
  | "balance_adjust"
  | "settings_update"
  | "coupon_apply"
  | "suspend"
  | "unsuspend"
  | "referral_commission"
  | "security_alert"
  | "provider_health";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  balance: number;
  coin_balance: number;
  role: AppRole;
  status: UserStatus;
  country: string | null;
  currency: string;
  timezone: string;
  referral_code: string | null;
  created_at: string;
  updated_at: string;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Provider = {
  id: string;
  name: string;
  api_url: string;
  api_key: string;
  api_key_encrypted: boolean;
  status: ProviderStatus;
  priority: number;
  balance: number | null;
  last_sync_at: string | null;
  sync_status: string | null;
  sync_message: string | null;
  config: Json;
  created_at: string;
  updated_at: string;
};

export type Service = {
  id: string;
  category_id: string | null;
  provider_id: string | null;
  provider_service_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  provider_price: number | null;
  min_quantity: number;
  max_quantity: number;
  average_time: string | null;
  type: string | null;
  is_active: boolean;
  is_featured: boolean;
  is_favorite: boolean;
  profit_margin: number;
  pricing_mode: "global" | "custom";
  meta: Json;
  created_at: string;
  updated_at: string;
};

export type Order = {
  id: string;
  order_number: string;
  user_id: string;
  service_id: string | null;
  provider_id: string | null;
  provider_order_id: string | null;
  link: string;
  quantity: number;
  price: number;
  status: OrderStatus;
  start_count: number | null;
  remain: number | null;
  cancel_count: number | null;
  refill_count: number | null;
  charge: number | null;
  currency: string;
  provider_response: Json | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentRequest = {
  id: string;
  user_id: string;
  method: string;
  sender_number: string;
  amount: number;
  currency: string;
  transaction_id: string;
  screenshot_url: string | null;
  note: string | null;
  status: PaymentStatus;
  admin_note: string | null;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Transaction = {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  balance_after: number | null;
  description: string | null;
  reference_id: string | null;
  reference_type: string | null;
  currency: string;
  meta: Json;
  created_at: string;
  updated_at: string;
};

export type Ticket = {
  id: string;
  ticket_number: string;
  user_id: string;
  subject: string;
  status: TicketStatus;
  priority: string;
  category: string | null;
  assigned_to: string | null;
  last_message_at: string;
  created_at: string;
  updated_at: string;
};

export type TicketMessage = {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  is_staff: boolean;
  attachment_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  is_read: boolean;
  link: string | null;
  created_at: string;
  updated_at: string;
};

export type SettingsRow = {
  id: string;
  key: string;
  value: Json;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type Coupon = {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_amount: number | null;
  max_discount: number | null;
  usage_limit: number | null;
  used_count: number;
  per_user_limit: number | null;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Log = {
  id: string;
  user_id: string | null;
  action: LogAction;
  entity_type: string | null;
  entity_id: string | null;
  description: string | null;
  ip: string | null;
  user_agent: string | null;
  meta: Json;
  created_at: string;
  updated_at: string;
};

export type ApiKey = {
  id: string;
  user_id: string | null;
  name: string;
  key_prefix: string;
  key_hash: string;
  permissions: Json;
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Favorite = {
  id: string;
  user_id: string;
  service_id: string;
  created_at: string;
  updated_at: string;
};

export type Referral = {
  id: string;
  referrer_id: string;
  referred_user_id: string;
  created_at: string;
  updated_at: string;
};

export type ReferralCommission = {
  id: string;
  referrer_id: string;
  referred_user_id: string;
  payment_request_id: string;
  transaction_id: string | null;
  deposit_amount: number;
  rate_percent: number;
  amount: number;
  currency: string;
  status: PaymentStatus;
  created_at: string;
  updated_at: string;
};

export type UserSession = {
  id: string;
  user_id: string;
  auth_session_id: string | null;
  user_agent: string;
  browser: string | null;
  os: string | null;
  device: string;
  device_type: string;
  city: string | null;
  region: string | null;
  country: string | null;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
};

export type ProviderHealthStatus = "healthy" | "slow" | "down" | "unknown";

export type ProviderHealth = {
  provider_id: string;
  status: ProviderHealthStatus;
  latency_ms: number | null;
  last_checked_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_error: string | null;
  total_checks: number;
  total_failures: number;
  updated_at: string;
};

export type NoticeCategory = "announcement" | "update" | "maintenance" | "offer";

export type Notice = {
  id: string;
  title: string;
  body: string | null;
  category: NoticeCategory;
  is_published: boolean;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type NoticeRead = {
  notice_id: string;
  user_id: string;
  read_at: string;
};

export type OrderGoalMetric = "followers" | "views" | "likes" | "comments" | "custom";
export type OrderGoalStatus = "active" | "completed" | "cancelled";

export type OrderGoal = {
  id: string;
  user_id: string;
  title: string;
  metric: OrderGoalMetric;
  target_quantity: number;
  service_id: string | null;
  link: string | null;
  status: OrderGoalStatus;
  created_at: string;
  updated_at: string;
};

export type LoginStreak = {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_claim_date: string | null;
  total_claims: number;
  cycle_start_date: string | null;
  cycle_coins: number;
  updated_at: string;
};

export type LoginReward = {
  id: string;
  user_id: string;
  claim_date: string;
  streak_day: number;
  amount: number;
  currency: string;
  transaction_id: string | null;
  coins: number;
  usd_value: number;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      categories: {
        Row: Category;
        Insert: Partial<Category>;
        Update: Partial<Category>;
        Relationships: [];
      };
      providers: {
        Row: Provider;
        Insert: Partial<Provider>;
        Update: Partial<Provider>;
        Relationships: [];
      };
      services: {
        Row: Service;
        Insert: Partial<Service>;
        Update: Partial<Service>;
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "services_provider_id_fkey";
            columns: ["provider_id"];
            isOneToOne: false;
            referencedRelation: "providers";
            referencedColumns: ["id"];
          }
        ];
      };
      orders: {
        Row: Order;
        Insert: Partial<Order>;
        Update: Partial<Order>;
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_provider_id_fkey";
            columns: ["provider_id"];
            isOneToOne: false;
            referencedRelation: "providers";
            referencedColumns: ["id"];
          }
        ];
      };
      payment_requests: {
        Row: PaymentRequest;
        Insert: Partial<PaymentRequest>;
        Update: Partial<PaymentRequest>;
        Relationships: [
          {
            foreignKeyName: "payment_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      transactions: {
        Row: Transaction;
        Insert: Partial<Transaction>;
        Update: Partial<Transaction>;
        Relationships: [
          {
            foreignKeyName: "transactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      tickets: {
        Row: Ticket;
        Insert: Partial<Ticket>;
        Update: Partial<Ticket>;
        Relationships: [
          {
            foreignKeyName: "tickets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      ticket_messages: {
        Row: TicketMessage;
        Insert: Partial<TicketMessage>;
        Update: Partial<TicketMessage>;
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticket_messages_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      notifications: {
        Row: Notification;
        Insert: Partial<Notification>;
        Update: Partial<Notification>;
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      settings: {
        Row: SettingsRow;
        Insert: Partial<SettingsRow>;
        Update: Partial<SettingsRow>;
        Relationships: [];
      };
      coupons: {
        Row: Coupon;
        Insert: Partial<Coupon>;
        Update: Partial<Coupon>;
        Relationships: [];
      };
      logs: {
        Row: Log;
        Insert: Partial<Log>;
        Update: Partial<Log>;
        Relationships: [
          {
            foreignKeyName: "logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      api_keys: {
        Row: ApiKey;
        Insert: Partial<ApiKey>;
        Update: Partial<ApiKey>;
        Relationships: [
          {
            foreignKeyName: "api_keys_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      favorites: {
        Row: Favorite;
        Insert: Partial<Favorite>;
        Update: Partial<Favorite>;
        Relationships: [
          {
            foreignKeyName: "favorites_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "favorites_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          }
        ];
      };
      referrals: {
        Row: Referral;
        Insert: Partial<Referral>;
        Update: Partial<Referral>;
        Relationships: [
          {
            foreignKeyName: "referrals_referrer_id_fkey";
            columns: ["referrer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "referrals_referred_user_id_fkey";
            columns: ["referred_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      referral_commissions: {
        Row: ReferralCommission;
        Insert: Partial<ReferralCommission>;
        Update: Partial<ReferralCommission>;
        Relationships: [
          {
            foreignKeyName: "referral_commissions_referrer_id_fkey";
            columns: ["referrer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "referral_commissions_referred_user_id_fkey";
            columns: ["referred_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "referral_commissions_payment_request_id_fkey";
            columns: ["payment_request_id"];
            isOneToOne: false;
            referencedRelation: "payment_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "referral_commissions_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          }
        ];
      };
      user_sessions: {
        Row: UserSession;
        Insert: Partial<UserSession>;
        Update: Partial<UserSession>;
        Relationships: [
          {
            foreignKeyName: "user_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      provider_health: {
        Row: ProviderHealth;
        Insert: Partial<ProviderHealth>;
        Update: Partial<ProviderHealth>;
        Relationships: [
          {
            foreignKeyName: "provider_health_provider_id_fkey";
            columns: ["provider_id"];
            isOneToOne: false;
            referencedRelation: "providers";
            referencedColumns: ["id"];
          }
        ];
      };
      notices: {
        Row: Notice;
        Insert: Partial<Notice>;
        Update: Partial<Notice>;
        Relationships: [];
      };
      notice_reads: {
        Row: NoticeRead;
        Insert: Partial<NoticeRead> & { notice_id: string; user_id: string };
        Update: Partial<NoticeRead>;
        Relationships: [
          {
            foreignKeyName: "notice_reads_notice_id_fkey";
            columns: ["notice_id"];
            isOneToOne: false;
            referencedRelation: "notices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notice_reads_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      order_goals: {
        Row: OrderGoal;
        Insert: Partial<OrderGoal> & { user_id: string; title: string; target_quantity: number };
        Update: Partial<OrderGoal>;
        Relationships: [
          {
            foreignKeyName: "order_goals_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_goals_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          }
        ];
      };
      login_streaks: {
        Row: LoginStreak;
        Insert: Partial<LoginStreak> & { user_id: string };
        Update: Partial<LoginStreak>;
        Relationships: [
          {
            foreignKeyName: "login_streaks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      login_rewards: {
        Row: LoginReward;
        Insert: Partial<LoginReward> & { user_id: string; claim_date: string; streak_day: number; amount: number };
        Update: Partial<LoginReward>;
        Relationships: [
          {
            foreignKeyName: "login_rewards_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: Record<never, never>; Returns: boolean };
      is_banned: { Args: Record<never, never>; Returns: boolean };
      current_profile: { Args: Record<never, never>; Returns: Profile };
      generate_referral_code: { Args: Record<never, never>; Returns: string };
      get_coupon: { Args: { p_code: string }; Returns: Coupon };
      deduct_order_cost: { Args: { p_order_id: string; p_user_id: string }; Returns: Order };
      create_ticket_with_message: {
        Args: {
          p_ticket_number: string;
          p_subject: string;
          p_priority: string;
          p_category?: string | null;
          p_message: string;
        };
        Returns: Ticket;
      };
      create_ticket_message: {
        Args: { p_ticket_id: string; p_message: string; p_is_staff?: boolean };
        Returns: TicketMessage;
      };
      refund_order: { Args: { p_order_id: string; p_refunded_by: string }; Returns: Order };
      create_notification: {
        Args: {
          p_user_id: string;
          p_type: NotificationType;
          p_title: string;
          p_body?: string | null;
          p_link?: string | null;
        };
        Returns: undefined;
      };
      use_coupon: {
        Args: {
          p_user_id: string;
          p_coupon_id: string;
          p_balance_after: number;
          p_currency: string;
          p_description: string;
        };
        Returns: undefined;
      };
      approve_payment: {
        Args: { p_id: string; admin_id: string; p_note?: string };
        Returns: PaymentRequest;
      };
      reject_payment: {
        Args: { p_id: string; admin_id: string; p_reason?: string };
        Returns: PaymentRequest;
      };
      adjust_balance: {
        Args: {
          target_user_id: string;
          amount: number;
          description: string;
          admin_id: string;
          tx_type?: TransactionType;
        };
        Returns: undefined;
      };
      apply_global_profit: {
        Args: { p_percentage: number; p_rounding: string };
        Returns: number;
      };
      sync_provider_services: {
        Args: { p_provider_id: string; p_items: unknown };
        Returns: { imported: number; updated: number }[];
      };
      list_user_sessions: {
        Args: Record<never, never>;
        Returns: {
          id: string;
          created_at: string;
          last_seen_at: string;
          user_agent: string | null;
          city: string | null;
          region: string | null;
          country: string | null;
        }[];
      };
      revoke_user_session: {
        Args: { p_session_id: string };
        Returns: boolean;
      };
      revoke_other_user_sessions: {
        Args: { p_current_session: string };
        Returns: number;
      };
      claim_daily_login_reward: {
        Args: Record<never, never>;
        Returns: Json;
      };
    };
    Enums: {
      app_role: AppRole;
      user_status: UserStatus;
      order_status: OrderStatus;
      payment_status: PaymentStatus;
      ticket_status: TicketStatus;
      transaction_type: TransactionType;
      provider_status: ProviderStatus;
      notification_type: NotificationType;
      log_action: LogAction;
    };
    CompositeTypes: Record<string, never>;
  };
};

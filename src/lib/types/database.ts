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
  | "adjustment";
export type ProviderStatus = "active" | "inactive";
export type NotificationType =
  | "payment_approved"
  | "payment_rejected"
  | "order_completed"
  | "order_cancelled"
  | "system_announcement"
  | "ticket_reply"
  | "order_status";
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
  | "unsuspend";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  balance: number;
  role: AppRole;
  status: UserStatus;
  country: string | null;
  currency: string;
  timezone: string;
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
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: Record<never, never>; Returns: boolean };
      is_banned: { Args: Record<never, never>; Returns: boolean };
      current_profile: { Args: Record<never, never>; Returns: Profile };
      get_coupon: { Args: { p_code: string }; Returns: Coupon };
      deduct_order_cost: { Args: { p_order_id: string; p_user_id: string }; Returns: Order };
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

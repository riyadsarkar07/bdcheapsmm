import type { HelpArticleCategory } from "@/lib/types/database";
import {
  LOGIN_CYCLE_MAX_COINS,
  LOGIN_CYCLE_MAX_USD,
  LOGIN_LADDER,
  COIN_USD_VALUE,
} from "@/lib/coins";
import type { PaymentSettings, ReferralSettings } from "@/lib/types/app";

export type HelpCatalogArticle = {
  slug: string;
  category: HelpArticleCategory;
  title: string;
  excerpt: string;
  body: string;
  sortOrder: number;
  isPopular: boolean;
};

export const HELP_CATEGORY_META: Record<
  HelpArticleCategory,
  { label: string; description: string; letter: string }
> = {
  "getting-started": {
    label: "Getting Started",
    description: "Account, login, profile and first steps",
    letter: "A",
  },
  ordering: {
    label: "Ordering",
    description: "Place orders, quantity, URLs and status",
    letter: "B",
  },
  payments: {
    label: "Payments & Wallet",
    description: "Add funds, methods, invoices and balance",
    letter: "C",
  },
  services: {
    label: "Services",
    description: "Catalog, categories, speed and quality",
    letter: "D",
  },
  "orders-safety": {
    label: "Orders & Safety",
    description: "History, retry, duplicates and stuck orders",
    letter: "E",
  },
  rewards: {
    label: "Daily Rewards & Coins",
    description: "Login streak, coin value and 30-day cap",
    letter: "F",
  },
  referrals: {
    label: "Referral System",
    description: "Invite users and earn commission",
    letter: "G",
  },
  notices: {
    label: "Notice Board & Notifications",
    description: "Announcements and unread alerts",
    letter: "H",
  },
  advisor: {
    label: "Smart Service Advisor",
    description: "Describe a goal and get recommendations",
    letter: "I",
  },
  security: {
    label: "Account Security",
    description: "Sessions, devices and safety tips",
    letter: "J",
  },
  support: {
    label: "Support",
    description: "Tickets, replies and when to contact us",
    letter: "K",
  },
  troubleshooting: {
    label: "Troubleshooting",
    description: "Common problems and how to fix them",
    letter: "L",
  },
};

export type HelpContext = {
  siteName: string;
  paymentMethods: string[];
  paymentNumbers: Partial<Record<"bKash" | "nagad" | "rocket", string>>;
  currency: string;
  referralRate: number;
  referralsEnabled: boolean;
};

export function buildHelpContext(input: {
  siteName: string;
  payments: PaymentSettings;
  currency?: string;
  referrals?: ReferralSettings | null;
}): HelpContext {
  const enabled = (input.payments.enabled ?? []).filter(Boolean);
  return {
    siteName: input.siteName || "BD Cheap SMM",
    paymentMethods: enabled.length > 0 ? enabled : ["bKash", "nagad", "rocket"],
    paymentNumbers: {
      bKash: input.payments.bKash || undefined,
      nagad: input.payments.nagad || undefined,
      rocket: input.payments.rocket || undefined,
    },
    currency: input.currency || "BDT",
    referralRate: input.referrals?.rate_percent ?? 5,
    referralsEnabled: input.referrals?.enabled ?? true,
  };
}

function interpolate(body: string, ctx: HelpContext): string {
  const methods = ctx.paymentMethods.join(", ");
  const numbers = ctx.paymentMethods
    .map((method) => {
      const key = method as "bKash" | "nagad" | "rocket";
      const number = ctx.paymentNumbers[key];
      return number ? `${method}: ${number}` : `${method}: shown on Add Funds when configured`;
    })
    .join("\n");
  return body
    .replaceAll("{{siteName}}", ctx.siteName)
    .replaceAll("{{paymentMethods}}", methods)
    .replaceAll("{{paymentNumbers}}", numbers)
    .replaceAll("{{currency}}", ctx.currency)
    .replaceAll("{{referralRate}}", String(ctx.referralRate))
    .replaceAll("{{coinUsd}}", String(COIN_USD_VALUE))
    .replaceAll("{{cycleCoins}}", String(LOGIN_CYCLE_MAX_COINS))
    .replaceAll("{{cycleUsd}}", LOGIN_CYCLE_MAX_USD.toFixed(2))
    .replaceAll("{{ladder}}", LOGIN_LADDER.join(", "));
}

export function applyHelpContext(article: HelpCatalogArticle, ctx: HelpContext): HelpCatalogArticle {
  return {
    ...article,
    title: interpolate(article.title, ctx),
    excerpt: interpolate(article.excerpt, ctx),
    body: interpolate(article.body, ctx),
  };
}

const articles: HelpCatalogArticle[] = [
  {
    slug: "create-an-account",
    category: "getting-started",
    title: "How to create an account",
    excerpt: "Register with email, set a strong password, then verify to start ordering.",
    isPopular: true,
    sortOrder: 10,
    body: `Open {{siteName}} and go to Register.

Enter your full name, a working email address, and a password with at least 8 characters, including uppercase, lowercase and a number. Confirm the password.

If you were invited, the register page may already include a referral code in the URL. You can leave that as-is.

After you submit, check your inbox (and spam) for the verification email. Confirm the link, then sign in from Login.

The first registered user on a new installation is promoted to admin. Everyone else starts as a normal user with a $0.00 wallet and 0 Coins.`,
  },
  {
    slug: "login-and-logout",
    category: "getting-started",
    title: "Login and logout",
    excerpt: "Sign in with email/password or Google, and always log out on shared devices.",
    isPopular: false,
    sortOrder: 20,
    body: `Go to Login and enter the email and password you used at registration. You can also continue with Google if that option is enabled.

Use Remember me on a private device. On a shared or public computer, leave it off and log out when you finish.

To log out, open your avatar menu in the top right and choose Sign out. This ends the current session only.

Forgot your password? Use Forgot password on the login page. We send a reset link to your email. The new password must meet the same strength rules.`,
  },
  {
    slug: "profile-and-settings",
    category: "getting-started",
    title: "Profile and settings",
    excerpt: "Update name, phone, timezone and display currency from Settings.",
    isPopular: false,
    sortOrder: 30,
    body: `Open Settings from the sidebar or your avatar menu.

You can update:
- Full name
- Phone number
- Country
- Display currency
- Timezone (default Asia/Dhaka)

Your email is tied to authentication and is not changed from this form.

Display currency affects how wallet amounts are labelled. Service and order prices are still quoted in USD.

Save changes before leaving the page. If something does not save, refresh and try again, then open a support ticket if it continues.`,
  },
  {
    slug: "active-sessions-overview",
    category: "getting-started",
    title: "Active sessions and security overview",
    excerpt: "See every signed-in device and remove ones you do not recognise.",
    isPopular: true,
    sortOrder: 40,
    body: `Settings includes Active Sessions. Each row shows device type, approximate location, when the session started, and last activity.

The current device is marked. You can sign out any other session, or sign out all other devices at once.

If you see a device or city you do not recognise, revoke it immediately, change your password, and review recent notifications for security alerts.

{{siteName}} also records new-device and new-location logins so you can spot unexpected access.`,
  },
  {
    slug: "place-an-order",
    category: "ordering",
    title: "How to place an order",
    excerpt: "Pick a service, enter a public URL, set quantity, then confirm the USD charge.",
    isPopular: true,
    sortOrder: 10,
    body: `1. Add funds so your wallet can cover the order.
2. Open Services and find the service you need.
3. Open the service page or order form.
4. Paste the target URL (must start with http:// or https://).
5. Enter a quantity between the service minimum and maximum.
6. Optionally add a coupon code.
7. Check the USD price. Place the order.

The cost is deducted from your wallet immediately. The order appears under My Orders with a status such as Pending or Processing.

If the URL already has an active order, you will see a duplicate warning. Read it before you continue.`,
  },
  {
    slug: "choose-a-service",
    category: "ordering",
    title: "How to choose a service",
    excerpt: "Match platform, metric, speed and min/max quantity to your goal.",
    isPopular: true,
    sortOrder: 20,
    body: `Use the Services browser to filter by category (Instagram, Facebook, YouTube, TikTok, Telegram and others).

Read the service name and description. Confirm:
- Platform (for example Instagram, not Facebook)
- Metric (followers, likes, views, comments)
- Minimum and maximum quantity
- Estimated speed if shown
- Whether refill is available

If you are unsure, use Smart Service Advisor: describe the goal in plain language and pick from real catalog matches.

Cheaper is not always better. A slower, refill-enabled service is often safer for a public profile than the cheapest burst option.`,
  },
  {
    slug: "service-requirements",
    category: "ordering",
    title: "Service requirements",
    excerpt: "The target must be public, correct, and able to receive the selected metric.",
    isPopular: false,
    sortOrder: 30,
    body: `Before you order, check the service description for extra rules. Typical requirements:

- The profile, post, video or channel must be public.
- Private, deleted, or region-locked links often cannot be filled.
- Use the exact post or profile URL the service asks for. A homepage URL will not work for a likes service.
- Do not change the username, privacy or URL while the order is running.
- Some services need an account with no recent similar orders on the same link.

If a requirement is listed on the service page, it is part of fulfilment. Orders that break those rules can stall, partial, or fail without a refill.`,
  },
  {
    slug: "quantity-min-max",
    category: "ordering",
    title: "Quantity, minimum and maximum",
    excerpt: "Stay inside the service min/max or the form will reject the order.",
    isPopular: false,
    sortOrder: 40,
    body: `Every service has a minimum and maximum quantity. The order form validates this before checkout.

Examples:
- A likes service might allow 50 to 10,000.
- A followers service might start at 100.

The price is based on the service rate and your quantity. Coupons apply only if the order meets coupon rules.

If you need more than the maximum, place a second order after the first completes. Do not stack two active orders on the same URL unless you understand the duplicate warning.`,
  },
  {
    slug: "target-url-requirements",
    category: "ordering",
    title: "Target URL requirements",
    excerpt: "Use a full http(s) link to the exact public post or profile.",
    isPopular: true,
    sortOrder: 50,
    body: `The link must start with http:// or https:// and point to the exact public target.

Good:
- https://instagram.com/p/xxxxx
- https://youtube.com/watch?v=xxxxx

Bad:
- instagram.com/p/xxxxx (missing https://)
- A shortened or tracking link that redirects through another site
- A private or login-only URL
- The wrong post from the same account

Copy the URL from the browser address bar or the app share sheet, then paste it without extra spaces.

{{siteName}} checks your other active orders for the same host and path and warns you about duplicates.`,
  },
  {
    slug: "order-status-meanings",
    category: "ordering",
    title: "Order status meanings",
    excerpt: "Pending, Processing, In Progress, Completed, Partial, Cancelled, Failed and more.",
    isPopular: true,
    sortOrder: 60,
    body: `Statuses you will see on My Orders and the order detail page:

- Pending: accepted, waiting to be sent to the provider.
- Processing: sent to the provider, not yet delivering.
- In Progress: delivery has started.
- Completed: the ordered quantity was delivered.
- Partial: some quantity was delivered, then the provider stopped.
- Cancelled: stopped before completion. A refund may apply depending on progress.
- Refunded: wallet was credited back.
- Failed: the provider could not start or complete the order.
- Rejected: the order was rejected (invalid link or service rules).

Status is updated automatically as the provider reports progress. Refresh the order page if it looks stale.`,
  },
  {
    slug: "start-count-remaining-progress",
    category: "ordering",
    title: "Start Count, Remaining and progress",
    excerpt: "Start Count is the metric before delivery. Remaining is what is left to send.",
    isPopular: false,
    sortOrder: 70,
    body: `On the order detail page:

- Start Count is the public count (followers, likes, views) recorded when the order began.
- Remaining is how much the provider still needs to deliver.
- Quantity is what you paid for.

Progress is Quantity minus Remaining, compared with Start Count.

Start Count can take a short time to appear. If it stays empty while status is Processing, wait, then use Refresh status on the order page.

Do not compare Start Count with a private analytics number. We use the public count the provider sees.`,
  },
  {
    slug: "processing-completed-partial-cancelled-failed",
    category: "ordering",
    title: "Processing, Completed, Partial, Cancelled and Failed",
    excerpt: "What each outcome means and what you should do next.",
    isPopular: false,
    sortOrder: 80,
    body: `Processing / In Progress: wait. Fast services can finish in minutes; others take hours. Avoid editing the target.

Completed: delivery finished. If drop happens later and the service supports refill, use Refill (limit applies).

Partial: part of the quantity arrived. Check Remaining. Open a ticket with the order number if it stays partial too long.

Cancelled / Refunded: the order stopped. Check Transactions for a refund entry.

Failed / Rejected: usually a private URL, wrong link type, or provider error. Fix the URL, confirm the profile is public, then place a new order or Retry if the button is available.`,
  },
  {
    slug: "how-to-add-funds",
    category: "payments",
    title: "How to Add Funds",
    excerpt: "Send money to the shown personal number, then submit TxID and screenshot.",
    isPopular: true,
    sortOrder: 10,
    body: `Open Add Funds.

1. Choose a method: {{paymentMethods}}.
2. Send Money to the personal number shown for that method.
3. Enter Sender Number, Amount ({{currency}}), and Transaction ID exactly as they appear in your payment app.
4. Attach a clear screenshot of the successful payment.
5. Submit.

An admin verifies the request manually. After approval, the amount is added to your wallet. Typical verification is a few minutes when details match.

Current numbers:
{{paymentNumbers}}

If a method has no number yet, contact support before sending money.`,
  },
  {
    slug: "supported-payment-methods",
    category: "payments",
    title: "Supported payment methods",
    excerpt: "Use only the methods enabled on Add Funds. Numbers come from live settings.",
    isPopular: false,
    sortOrder: 20,
    body: `{{siteName}} currently accepts manual Send Money through: {{paymentMethods}}.

Enabled methods and numbers are loaded from site payment settings, not from this article. Always copy the number shown on the Add Funds page at the moment you pay.

Do not send money to an old number from a screenshot or a message outside the panel.

If a method is missing from Add Funds, it is not enabled. Do not invent a number or use a personal contact claiming to be staff.`,
  },
  {
    slug: "payment-instructions",
    category: "payments",
    title: "Payment instructions",
    excerpt: "Match number and amount, then submit TxID. Wrong details delay approval.",
    isPopular: true,
    sortOrder: 30,
    body: `Follow the bilingual instructions on Add Funds:

- Send Money (not Payment / Merchant) to the personal number shown.
- Check the number and amount before you send.
- After paying, enter Sender Number, Amount and Transaction ID correctly.
- Admin verifies the transaction manually.
- After a successful match, balance is added to your wallet.
- Incorrect information can delay approval.

Keep the payment SMS or app receipt until the request is Approved.`,
  },
  {
    slug: "usd-bdt-rate",
    category: "payments",
    title: "USD and BDT rate explanation",
    excerpt: "Wallet display can use BDT. Service prices stay in USD.",
    isPopular: false,
    sortOrder: 40,
    body: `Orders and services are priced in USD because the provider catalog is USD.

Your profile currency (often BDT) is used when you submit a deposit and when the wallet badge formats your balance.

The Add Funds page shows the current USD to BDT reference rate used for deposits. Read that banner before you send money. Do not use a third-party rate from Google or a Facebook post.

If your deposit is in BDT, submit the BDT amount you actually sent, together with the matching screenshot and Transaction ID.`,
  },
  {
    slug: "payment-screenshot-requirements",
    category: "payments",
    title: "Payment screenshot requirements",
    excerpt: "Upload a PNG, JPG, WebP or GIF under 5MB that shows TxID, amount and number.",
    isPopular: false,
    sortOrder: 50,
    body: `A screenshot is strongly recommended and speeds up approval.

Requirements:
- Image type: PNG, JPEG, WebP or GIF
- Size: under 5MB
- Must show the successful Send Money screen
- Must include Transaction ID, amount, and destination number

Do not crop out the TxID. Do not submit a screenshot of the wrong payment.

If a screenshot does not appear later in history, the upload may have failed. Submit a new request only if the first one is not listed. Otherwise reply via a support ticket with the same TxID.`,
  },
  {
    slug: "pending-approved-rejected-payments",
    category: "payments",
    title: "Pending, Approved and Rejected payments",
    excerpt: "Pending waits for admin. Approved credits the wallet. Rejected includes a note.",
    isPopular: true,
    sortOrder: 60,
    body: `Each deposit request has a status:

- Pending: submitted, waiting for manual verification. Do not send a second payment for the same TxID.
- Approved: wallet credited. Download the deposit invoice from history.
- Rejected: not credited. Read the admin note. Common causes are wrong TxID, wrong amount, or a screenshot that does not match.

Rejected does not automatically return money in the panel because the wallet was never credited. If you sent funds and the request was rejected in error, open a support ticket with the TxID and screenshot.`,
  },
  {
    slug: "wallet-balance-and-transactions",
    category: "payments",
    title: "Wallet balance and transactions",
    excerpt: "The header badge is your spendable balance. Transactions is the full ledger.",
    isPopular: false,
    sortOrder: 70,
    body: `Your wallet balance is shown in the top header. Orders deduct from this balance. Coins are separate and never added here.

Open Transactions to see:
- Deposit (approved funds)
- Order (deduction)
- Refund
- Adjustment
- Referral commission
- Login reward (legacy USD rewards only; new daily claims credit Coins, not this wallet)

If a deposit is Approved but the badge did not change, refresh the page. If it still differs from Transactions, open a ticket.`,
  },
  {
    slug: "deposit-invoice",
    category: "payments",
    title: "Deposit invoice",
    excerpt: "Download a PDF invoice from an approved payment in deposit history.",
    isPopular: false,
    sortOrder: 80,
    body: `After a payment is Approved, Deposit History shows an Invoice button.

The file is a PDF for that request: method, amount, currency, Transaction ID and timestamps.

Pending and Rejected payments do not have an invoice because they did not credit the wallet.

Keep invoices for your records. They do not replace the original bKash / Nagad / Rocket receipt.`,
  },
  {
    slug: "service-categories",
    category: "services",
    title: "Service categories",
    excerpt: "Browse by platform and type such as followers, likes, views and comments.",
    isPopular: false,
    sortOrder: 10,
    body: `Services are grouped into categories maintained by admins (Instagram, Facebook, YouTube, TikTok, Telegram, and others as configured).

Use category chips and search in Services. Featured and favourite services appear first when available.

A category being listed does not mean every service inside it is in stock. If a service is inactive, it will not be orderable.`,
  },
  {
    slug: "service-descriptions",
    category: "services",
    title: "Service descriptions",
    excerpt: "Read name, description, min/max and extras before you pay.",
    isPopular: false,
    sortOrder: 20,
    body: `Each service page includes:

- Name and category
- Description and type
- Rate (USD)
- Minimum and maximum quantity
- Extra flags such as refill when the provider supports it

Descriptions come from the catalog (including imported provider data) plus admin edits. If a description conflicts with a Notice Board post, follow the newer notice.

When in doubt, start with a small quantity on a public test post.`,
  },
  {
    slug: "speed-and-quality",
    category: "services",
    title: "Speed and quality information",
    excerpt: "Speed estimates are typical, not a guarantee. Quality varies by service.",
    isPopular: false,
    sortOrder: 30,
    body: `Some services show speed hints (for example start time or drip vs instant). These are typical ranges from the provider, not a promise.

Quality also varies:
- High-quality / refill services cost more and are better for long-term public profiles.
- Cheap / no-refill services can drop after completion.

Never promise a client an exact minute count based on the panel. Use Order Goals and the Advisor if you need a plan rather than a single burst.`,
  },
  {
    slug: "provider-health",
    category: "services",
    title: "Provider Health",
    excerpt: "Admins monitor provider latency and uptime. Outages can delay new orders.",
    isPopular: false,
    sortOrder: 40,
    body: `{{siteName}} sends orders to external SMM providers. Admins see Provider Health (healthy, slow, down, unknown) based on recent checks.

If a provider is slow or down:
- New orders may stay Pending or Processing longer.
- Status updates can lag.

Users do not change providers. If many orders stall, check the Notice Board for maintenance, then wait or contact support with order numbers rather than placing duplicates.`,
  },
  {
    slug: "choose-the-right-service",
    category: "services",
    title: "How to choose the right service",
    excerpt: "Match platform, metric, budget and whether you need refill.",
    isPopular: true,
    sortOrder: 50,
    body: `Ask four questions:

1. Which platform and which URL?
2. Which metric (followers, likes, views, comments)?
3. How many, and is that inside min/max?
4. Do I need refill if drop happens?

Then compare two or three services in that category. Prefer a clear description and refill over the lowest rate if the link is a main business profile.

You can also describe the goal in Smart Service Advisor and pick from the recommended catalog rows.`,
  },
  {
    slug: "order-history",
    category: "orders-safety",
    title: "Order history",
    excerpt: "My Orders lists every order with number, service, quantity, price and status.",
    isPopular: false,
    sortOrder: 10,
    body: `Open My Orders to see your history. Each row includes order number, service name, quantity, USD amount, status and date.

Click an order to open details, refresh status, request refill, retry, or download an invoice where available.

Use this list before placing a new order on the same URL so you do not duplicate an active job.`,
  },
  {
    slug: "order-details",
    category: "orders-safety",
    title: "Order details",
    excerpt: "One page for link, quantity, start count, remaining, refill and actions.",
    isPopular: false,
    sortOrder: 20,
    body: `The order detail page shows:

- Order number and status
- Service name
- Target link
- Quantity, charge, Start Count, Remaining
- Refill count
- Timestamps

Actions (when allowed): Refresh status, Refill, Retry, Cancel.

Refresh status asks the provider for the latest counts. Use it if the page looks old, but do not spam it.`,
  },
  {
    slug: "retry-and-reorder",
    category: "orders-safety",
    title: "Retry and reorder",
    excerpt: "Retry failed orders when the button is shown. Otherwise place a new order.",
    isPopular: false,
    sortOrder: 30,
    body: `Retry is available on some Failed orders that still have a valid service and link. It resubmits to the provider. Your wallet is charged according to the retry rules shown in the panel.

Reorder means opening the same service and placing a new order. Do this only after the previous order is Completed, Cancelled, Failed or Refunded.

Do not retry and also create a new order for the same URL at the same time.

Refill is different: it asks the provider to restore drop on a completed order and is limited (typically up to 2 refills per order).`,
  },
  {
    slug: "url-safety-duplicate-warning",
    category: "orders-safety",
    title: "URL Safety and duplicate warning",
    excerpt: "The form warns if you already have an active order on the same link.",
    isPopular: true,
    sortOrder: 40,
    body: `When you paste a link, {{siteName}} checks your active orders (Pending, Processing, In Progress, Partial) for the same website host and path.

If a match is found, you see a duplicate warning with the existing order number and status.

This is a safety check, not a ban. You can still continue, but you should usually wait until the first order finishes.

The check ignores www. and trailing slashes so https://www.example.com/p/1 and https://example.com/p/1/ count as the same target.`,
  },
  {
    slug: "why-duplicate-orders-cause-issues",
    category: "orders-safety",
    title: "Why duplicate orders can cause issues",
    excerpt: "Two active jobs on one URL confuse start counts and can stall or over-deliver.",
    isPopular: false,
    sortOrder: 50,
    body: `Two active orders on one URL can:

- Mix Start Count between jobs
- Make Remaining look stuck
- Cause the provider to skip or throttle the second job
- Deliver more than you wanted, with no easy cancel

Duplicate likes or views on a post can also look unnatural and drop faster.

Wait for Completed, Partial (stable), Cancelled or Failed before ordering the same link again. If you stacked by mistake, do not place a third order. Open a ticket with both order numbers.`,
  },
  {
    slug: "stuck-or-partial-orders",
    category: "orders-safety",
    title: "What to do if an order is stuck or partial",
    excerpt: "Refresh once, wait, check the URL, then contact support with the order number.",
    isPopular: true,
    sortOrder: 60,
    body: `If status stays Processing or In Progress for a long time:

1. Confirm the target is still public and the URL did not change.
2. Use Refresh status once on the order page.
3. Check Notice Board for provider or maintenance news.
4. Wait. Many services start slowly then complete in a burst.

If it becomes Partial and Remaining does not move:

- Note Start Count, Remaining and quantity.
- Do not place a duplicate.
- Open Support with the order number, URL and a screenshot of the public count.

Refill is for completed orders that later drop, not for orders that never finished.`,
  },
  {
    slug: "daily-login-reward",
    category: "rewards",
    title: "How Daily Login Reward works",
    excerpt: "Claim once per Dhaka calendar day. Coins go to coin balance, never the USD wallet.",
    isPopular: true,
    sortOrder: 10,
    body: `Open Daily Reward once per day.

You may claim once per Asia/Dhaka calendar day. The button disables after a successful claim.

Rewards are Coins, not USD wallet credit. 1 Coin = $\{{coinUsd}}. A full 30-day cycle is capped at {{cycleCoins}} Coins ($\{{cycleUsd}}).

The page shows coin balance, current streak, longest streak, total claims and history. Claims are enforced in the database, so refreshing will not create a second claim for the same Dhaka day.`,
  },
  {
    slug: "seven-day-streak",
    category: "rewards",
    title: "7-day streak",
    excerpt: "The ladder repeats every 7 days. Missing a day resets the streak to Day 1.",
    isPopular: false,
    sortOrder: 20,
    body: `The 7-day ladder is: {{ladder}} Coins.

Claiming on consecutive Dhaka days increases the streak. Day 8 repeats Day 1 of the ladder.

If you miss a calendar day, the streak returns to Day 1 on the next claim. The 30-day coin cycle is separate: it still counts toward the {{cycleCoins}} Coin cap until 30 days from cycle start.`,
  },
  {
    slug: "coin-balance",
    category: "rewards",
    title: "Coin balance",
    excerpt: "Coins are stored on your profile, shown in the header, and never mixed with wallet USD.",
    isPopular: false,
    sortOrder: 30,
    body: `Coin balance appears:

- In the header next to wallet balance
- On the Daily Reward page

Daily claims add Coins only. They do not create a deposit transaction and do not change spendable wallet balance.

Coins cannot be used to place orders. Wallet USD is what pays for services.`,
  },
  {
    slug: "how-coins-are-earned",
    category: "rewards",
    title: "How coins are earned",
    excerpt: "Log in and claim the daily reward. Amount follows the 7-day ladder and the 30-day cap.",
    isPopular: false,
    sortOrder: 40,
    body: `You earn Coins only by claiming Daily Login Reward.

Each claim uses the 7-day ladder ({{ladder}}) and then applies the remaining room in the 30-day cycle so you cannot exceed {{cycleCoins}} Coins.

There is no USD cashout for Coins. History on the Daily Reward page lists each claim with Coins and the USD equivalent for reference only.`,
  },
  {
    slug: "coin-value",
    category: "rewards",
    title: "Coin value: 1 Coin = $0.001",
    excerpt: "Coins are displayed with a USD equivalent. Wallet USD is never credited.",
    isPopular: true,
    sortOrder: 50,
    body: `1 Coin = $\{{coinUsd}}.

The Daily Reward page always shows both Coins and the USD equivalent so the value is clear. Example: 8 Coins = $0.008.

This equivalent is informational. Claiming does not add $0.001 (or any USD) to your wallet.`,
  },
  {
    slug: "thirty-day-coin-maximum",
    category: "rewards",
    title: "30-day maximum = 150 Coins = $0.15",
    excerpt: "A complete 30-day cycle is exactly 150 Coins. The cap is enforced in the database.",
    isPopular: true,
    sortOrder: 60,
    body: `A full 30-day cycle totals exactly {{cycleCoins}} Coins ($\{{cycleUsd}}).

The repeating weekly ladder is {{ladder}} Coins (36 per week). Four weeks plus Day 29 and Day 30 (3 + 3) equals 150.

When cycle remaining hits 0, further claims wait until a new 30-day cycle starts. The server rejects extra claims even if the page is stale.`,
  },
  {
    slug: "claim-rules-and-missed-days",
    category: "rewards",
    title: "Claim rules and missed-day behavior",
    excerpt: "One claim per Dhaka day. Missed days reset streak, not necessarily the 30-day cycle.",
    isPopular: false,
    sortOrder: 70,
    body: `Rules:

- One claim per user per Asia/Dhaka calendar day
- Duplicate claims are blocked in the database
- Missing a day resets the 7-day streak to Day 1
- The 30-day cycle continues until 30 days from cycle start or until {{cycleCoins}} Coins are reached
- USD wallet is never credited

If the button says Already claimed today, you are done until Dhaka midnight.`,
  },
  {
    slug: "how-referral-links-work",
    category: "referrals",
    title: "How referral links work",
    excerpt: "Your unique code is attached at registration. Self-referrals are blocked.",
    isPopular: true,
    sortOrder: 10,
    body: `Open Referrals to copy your link. It looks like:

{{siteName}} register URL with ?ref=YOURCODE

When someone registers with that link, they are attached to you once. Each user can only have one referrer. You cannot refer yourself.

Your referral code is generated automatically and cannot be edited from profile settings.`,
  },
  {
    slug: "invite-users",
    category: "referrals",
    title: "How to invite users",
    excerpt: "Share your referral link. The invitee must register and later deposit for commission.",
    isPopular: false,
    sortOrder: 20,
    body: `Copy the link from the Referrals page and share it privately (chat, email, or your site).

The invitee must:
1. Open the link
2. Create an account
3. Verify email and sign in

Registration alone does not pay commission. Commission is created when that user's deposit is approved, if referrals are enabled.`,
  },
  {
    slug: "referral-commission",
    category: "referrals",
    title: "Referral commission",
    excerpt: "Earn a percentage of each approved deposit from users you referred.",
    isPopular: true,
    sortOrder: 30,
    body: `When referrals are enabled, you earn {{referralRate}}% of each approved deposit made by a user you referred.

The rate is set by admins in referral settings and applied in the database at approval time. The panel never trusts a rate sent from the browser.

Commission is wallet credit (not Coins) and appears in Referral history and Transactions as Referral.`,
  },
  {
    slug: "when-commission-is-credited",
    category: "referrals",
    title: "When commission is credited",
    excerpt: "Credit happens when the referred user's payment request is approved, once per payment.",
    isPopular: false,
    sortOrder: 40,
    body: `Commission is credited only when an admin approves the referred user's Add Funds request.

- Pending deposits do not pay commission
- Rejected deposits do not pay commission
- Each payment can generate commission once

If referrals are disabled in settings, new approvals will not create commission even if the user registered with your link.`,
  },
  {
    slug: "referral-history",
    category: "referrals",
    title: "Referral history",
    excerpt: "See invited users, deposit totals and commission earned on the Referrals page.",
    isPopular: false,
    sortOrder: 50,
    body: `The Referrals page lists each invited user with:

- When they joined
- Approved deposit total (if any)
- Commission you earned

Summary cards show total referrals, total earned, approved commissions and pending referrals (joined but no approved deposit yet).`,
  },
  {
    slug: "how-to-read-notices",
    category: "notices",
    title: "How to read notices",
    excerpt: "Notice Board shows published admin announcements, updates, maintenance and offers.",
    isPopular: false,
    sortOrder: 10,
    body: `Open Notice Board from the sidebar. Only published notices appear.

Categories include announcement, update, maintenance and offer. Unread notices count on the sidebar badge.

Open a notice to read the full body. Once viewed, it is marked read for your account.`,
  },
  {
    slug: "unread-notifications",
    category: "notices",
    title: "Unread notifications",
    excerpt: "The bell lists payment, order, ticket, referral and security alerts.",
    isPopular: true,
    sortOrder: 20,
    body: `The bell in the header opens in-app notifications, including:

- Payment approved or rejected
- Order completed, cancelled or status change
- Support ticket reply
- Referral commission
- Security alert
- System announcement

Open Notifications for the full list. Tap an item to jump to the related page when a link is included.`,
  },
  {
    slug: "important-announcements",
    category: "notices",
    title: "Important announcements",
    excerpt: "Maintenance and provider issues are posted on Notice Board first.",
    isPopular: false,
    sortOrder: 30,
    body: `Before you assume an order or payment is broken, check Notice Board.

Admins post maintenance windows, provider delays and offers there. Those posts override older Help Center advice if something is temporarily different.

If a notice says a provider is down, wait rather than placing duplicate orders.`,
  },
  {
    slug: "describe-a-goal",
    category: "advisor",
    title: "How to describe a goal",
    excerpt: "Write the platform, metric and size in plain language, then run Advisor.",
    isPopular: true,
    sortOrder: 10,
    body: `Open Smart Service Advisor and describe what you want in a short sentence.

Useful details:
- Platform (Instagram, YouTube, TikTok, Facebook, Telegram)
- Metric (followers, views, likes, comments)
- Rough quantity
- Whether the link is a profile, post or video

Example: "I need 2,000 Instagram post likes for a public photo."

Vague text such as "make me famous" returns weaker matches.`,
  },
  {
    slug: "how-recommendations-work",
    category: "advisor",
    title: "How recommendations work",
    excerpt: "Advisor matches your text to real catalog services. It does not invent products.",
    isPopular: false,
    sortOrder: 20,
    body: `Advisor searches the live service catalog. Recommendations are real rows you can open and order.

It does not guarantee speed, refill or results. Always open the service page and check min/max, description and price before paying.

If nothing matches, try different keywords or browse Services by category.`,
  },
  {
    slug: "platform-and-service-type-matching",
    category: "advisor",
    title: "Platform and service type matching",
    excerpt: "Advisor uses platform plus metric so you do not order YouTube views for Instagram.",
    isPopular: false,
    sortOrder: 30,
    body: `Matching looks at platform and service type together.

If you ask for TikTok views, Instagram follower services should not lead the list. Still verify the service name before checkout.

You can also set Order Goals (followers, views, likes, comments, or custom) and track quantity separately from Advisor.`,
  },
  {
    slug: "suspicious-activity-alerts",
    category: "security",
    title: "Suspicious activity alerts",
    excerpt: "Security notifications warn about unusual logins. Revoke sessions if needed.",
    isPopular: false,
    sortOrder: 10,
    body: `{{siteName}} can send a security alert when login activity looks unusual.

If you get one:
1. Open Settings > Active Sessions
2. Sign out devices you do not recognise
3. Change your password from a device you trust
4. Review recent orders and payment requests

Never share your password or email verification link.`,
  },
  {
    slug: "new-device-location-alerts",
    category: "security",
    title: "New device and location alerts",
    excerpt: "New browsers or cities can trigger an alert so you can confirm it was you.",
    isPopular: true,
    sortOrder: 20,
    body: `Signing in from a new browser, phone or city may create a security notification.

If it was you, you can ignore it after checking Active Sessions. If it was not you, revoke other sessions immediately and change your password.

Location is approximate (city / region / country) from the login request. A VPN can make your usual login look new.`,
  },
  {
    slug: "manage-active-sessions",
    category: "security",
    title: "Active sessions",
    excerpt: "See device, location and last seen. Sign out any session you do not trust.",
    isPopular: false,
    sortOrder: 30,
    body: `Active Sessions lists every signed-in device with:

- Device type (mobile, tablet, desktop)
- Approximate location
- Created time and last seen

The current session is labelled. Signing out a session ends it immediately. That user will need to log in again.`,
  },
  {
    slug: "logout-all-other-sessions",
    category: "security",
    title: "Logout all other sessions",
    excerpt: "Keep this device signed in and end every other session in one step.",
    isPopular: false,
    sortOrder: 40,
    body: `In Active Sessions, use the control to sign out every other device. You stay signed in on the current browser.

Use this after a password change, a shared-computer login, or a security alert.

This does not delete your account or wallet. It only ends sessions.`,
  },
  {
    slug: "security-best-practices",
    category: "security",
    title: "Security best practices",
    excerpt: "Unique password, trusted devices, and never pay outside Add Funds.",
    isPopular: true,
    sortOrder: 50,
    body: `Protect your {{siteName}} account:

- Use a unique password with upper, lower and a number
- Do not reuse the password from email or Facebook
- Log out on shared devices
- Review Active Sessions monthly
- Only send money to numbers shown on Add Funds
- Staff will not ask for your password in a ticket

If you think someone else placed orders, change the password, revoke other sessions, and contact support with the order numbers.`,
  },
  {
    slug: "create-a-support-ticket",
    category: "support",
    title: "How to create a support ticket",
    excerpt: "Open Support, choose subject and priority, then describe the issue clearly.",
    isPopular: true,
    sortOrder: 10,
    body: `Go to Support > New Ticket.

Fill in:
- Subject
- Category (if asked)
- Priority (low, normal, high)
- Message

Submit once. Duplicate tickets on the same order slow the reply.

You can follow the thread on the ticket page. Staff replies also appear as notifications.`,
  },
  {
    slug: "what-information-to-provide",
    category: "support",
    title: "What information to provide",
    excerpt: "Include order number, URL, TxID or screenshot so staff can act without extra questions.",
    isPopular: true,
    sortOrder: 20,
    body: `Include everything relevant in the first message:

Orders: order number, service name, target URL, current public count, status, what you already tried.

Payments: method, amount, Transaction ID, sender number, request status.

Account: approximate time of the issue and browser/device if it is a login problem.

Do not send your password. Do not send money to a personal number posted in chat.`,
  },
  {
    slug: "check-ticket-replies",
    category: "support",
    title: "How to check ticket replies",
    excerpt: "Open the ticket thread. Status can be Open, Waiting or Closed.",
    isPopular: false,
    sortOrder: 30,
    body: `Support lists your tickets. Open one to read the full thread.

Statuses:
- Open: waiting on staff or still active
- Waiting: usually waiting on your reply
- Closed: finished. Open a new ticket if the issue returns

A staff reply sends an in-app notification. Reply in the same ticket instead of creating a new one.`,
  },
  {
    slug: "when-to-contact-support",
    category: "support",
    title: "When to contact support",
    excerpt: "Use tickets for payments, stuck orders and account issues after checking Help Center.",
    isPopular: false,
    sortOrder: 40,
    body: `Contact support when:

- A payment is pending far longer than usual with correct TxID
- An order is stuck or partial after you refreshed once and waited
- A screenshot or invoice is missing
- You see a session that is not yours

Do not contact support to ask for a cheaper custom rate in a ticket, to skip Add Funds, or to run a second order on the same URL while the first is active.

Check Help Center and Notice Board first. Many delays are already explained there.`,
  },
  {
    slug: "order-not-starting",
    category: "troubleshooting",
    title: "Order not starting",
    excerpt: "Pending or Processing with no Start Count usually means the provider has not begun.",
    isPopular: true,
    sortOrder: 10,
    body: `If the order stays Pending:

- Wallet was charged, so the panel accepted it
- It may be queued for the provider
- Check Notice Board for delays

If it is Processing with empty Start Count, wait and refresh status once.

Confirm the URL is public. Private accounts often never start. Do not place a duplicate while this order is active.`,
  },
  {
    slug: "order-stuck-in-processing",
    category: "troubleshooting",
    title: "Order stuck in processing",
    excerpt: "Refresh once, verify the link, then wait or open a ticket with the order number.",
    isPopular: true,
    sortOrder: 20,
    body: `Stuck Processing / In Progress:

1. Make sure the post or profile is still public
2. Refresh status on the order page once
3. Compare public count with Start Count if it exists
4. Wait for a burst. Slow services can sit then complete

If nothing changes for a long time, open a ticket. Include order number, URL and a screenshot of the public page. Do not reorder the same link yet.`,
  },
  {
    slug: "wrong-url",
    category: "troubleshooting",
    title: "Wrong URL",
    excerpt: "Orders run on the link you submitted. Fix it only if Cancel is still available.",
    isPopular: false,
    sortOrder: 30,
    body: `If you submitted the wrong URL, open the order immediately.

If status is still Pending, try Cancel if the button is available, then place a new order with the correct https link.

If the order is already Processing or In Progress, cancellation may not be possible. Contact support with the order number. Do not assume a refill will move likes to another post.`,
  },
  {
    slug: "duplicate-order-problem",
    category: "troubleshooting",
    title: "Duplicate order",
    excerpt: "Stop placing more jobs. Let active ones finish or ask support with both numbers.",
    isPopular: false,
    sortOrder: 40,
    body: `If you already have two active orders on one URL:

- Do not place a third
- Note both order numbers
- Wait if one is about to complete
- Otherwise open a ticket listing both numbers and the URL

The duplicate warning exists to prevent this. Next time, wait for a terminal status (Completed, Partial, Cancelled, Failed, Refunded).`,
  },
  {
    slug: "payment-not-approved",
    category: "troubleshooting",
    title: "Payment not approved",
    excerpt: "Match TxID, amount and number. Pending is normal until an admin verifies.",
    isPopular: true,
    sortOrder: 50,
    body: `If Add Funds stays Pending:

- Confirm Transaction ID, amount and destination number match the screenshot
- Do not send a second payment for the same TxID
- Wait for manual verification

If it is Rejected, read the admin note. Fix the data and submit a new request only if you actually sent a new payment, or contact support if the original payment was valid.

Approved payments credit the wallet. Refresh if the header badge is stale.`,
  },
  {
    slug: "screenshot-not-showing",
    category: "troubleshooting",
    title: "Screenshot not showing",
    excerpt: "Use PNG/JPEG/WebP/GIF under 5MB. If history has no request, the upload failed.",
    isPopular: false,
    sortOrder: 60,
    body: `If the preview never appeared on the form, the file may be too large or the wrong type.

If the request exists in history without a screenshot, tell support the request time and TxID. Do not create a second deposit for the same payment.

Allowed types: PNG, JPEG, WebP, GIF. Maximum size: 5MB. The image must show TxID, amount and number.`,
  },
  {
    slug: "balance-or-payment-issue",
    category: "troubleshooting",
    title: "Balance or payment issue",
    excerpt: "Compare header balance with Transactions and deposit history.",
    isPopular: false,
    sortOrder: 70,
    body: `Checklist:

1. Is the payment Approved? Only approved deposits credit the wallet.
2. Open Transactions. Deposits increase balance; orders decrease it.
3. Coins are not wallet USD. Daily Reward does not change spendable balance.
4. Refresh the page.

If Transactions and the header still disagree, open a ticket with screenshots of both. Do not pay a third party who claims they can add balance.`,
  },
  {
    slug: "service-unavailable",
    category: "troubleshooting",
    title: "Service unavailable",
    excerpt: "Inactive or out-of-stock services cannot be ordered. Pick another or wait.",
    isPopular: false,
    sortOrder: 80,
    body: `If a service is missing or the order button is disabled, it is inactive or not in the catalog.

Use search and categories to find an alternative with the same platform and metric. Check min/max before switching.

Admins can disable a service during provider issues. Check Notice Board. Do not try to order through a copied old URL if the service was removed.`,
  },
  {
    slug: "provider-issue",
    category: "troubleshooting",
    title: "Provider issue",
    excerpt: "External providers can be slow or down. Duplicates make recovery harder.",
    isPopular: false,
    sortOrder: 90,
    body: `Orders are fulfilled by external providers. If Provider Health is slow or down, new orders and status updates lag.

What you should do:
- Check Notice Board
- Wait on existing orders
- Avoid duplicates
- Contact support with order numbers if the outage lasts

You cannot switch providers yourself. Refunds, if any, follow order status (Cancelled, Failed, Partial) as recorded in the panel.`,
  },
];

export function getHelpCatalog(): HelpCatalogArticle[] {
  return articles;
}

export type HelpArticleView = {
  id: string | null;
  slug: string;
  category: HelpArticleCategory;
  title: string;
  excerpt: string;
  body: string;
  sortOrder: number;
  isPublished: boolean;
  isPopular: boolean;
  helpfulYes: number;
  helpfulNo: number;
  source: "catalog" | "database";
};

export function catalogToView(article: HelpCatalogArticle, ctx: HelpContext): HelpArticleView {
  const resolved = applyHelpContext(article, ctx);
  return {
    id: null,
    slug: resolved.slug,
    category: resolved.category,
    title: resolved.title,
    excerpt: resolved.excerpt,
    body: resolved.body,
    sortOrder: resolved.sortOrder,
    isPublished: true,
    isPopular: resolved.isPopular,
    helpfulYes: 0,
    helpfulNo: 0,
    source: "catalog",
  };
}

export function mergeHelpArticles(
  dbRows: Array<{
    id: string;
    slug: string;
    category: HelpArticleCategory;
    title: string;
    excerpt: string | null;
    body: string;
    sort_order: number;
    is_published: boolean;
    is_popular: boolean;
    helpful_yes: number;
    helpful_no: number;
  }>,
  ctx: HelpContext,
  includeUnpublished = false
): HelpArticleView[] {
  const catalog = getHelpCatalog().map((article) => catalogToView(article, ctx));
  const bySlug = new Map(catalog.map((article) => [article.slug, article]));

  for (const row of dbRows) {
    const interpolated: HelpArticleView = {
      id: row.id,
      slug: row.slug,
      category: row.category,
      title: interpolate(row.title, ctx),
      excerpt: interpolate(row.excerpt ?? "", ctx),
      body: interpolate(row.body, ctx),
      sortOrder: row.sort_order,
      isPublished: row.is_published,
      isPopular: row.is_popular,
      helpfulYes: row.helpful_yes,
      helpfulNo: row.helpful_no,
      source: "database",
    };
    bySlug.set(row.slug, interpolated);
  }

  return Array.from(bySlug.values())
    .filter((article) => includeUnpublished || article.isPublished)
    .sort((a, b) => {
      const catA = HELP_CATEGORY_META[a.category]?.letter ?? "Z";
      const catB = HELP_CATEGORY_META[b.category]?.letter ?? "Z";
      if (catA !== catB) return catA.localeCompare(catB);
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.title.localeCompare(b.title);
    });
}

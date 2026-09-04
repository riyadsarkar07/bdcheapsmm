import {
  deviceLabel,
  locationLabel,
  normalizeUserAgentKey,
  parseUserAgent,
  type GeoInfo,
} from "@/lib/user-agent";

const LOGIN_WINDOW_DAYS = 30;

interface HeaderLike {
  get(name: string): string | null;
}

export interface LoginContext {
  ip: string;
  userAgent: string;
  browser: string;
  os: string;
  device: string;
  deviceType: "mobile" | "tablet" | "desktop";
  geo: GeoInfo;
  location: string;
  uaKey: string;
}

export function decodeAccessTokenPayload(accessToken: string | null | undefined): Record<string, unknown> | null {
  if (!accessToken) return null;
  try {
    const part = accessToken.split(".")[1];
    if (!part) return null;
    const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(normalized, "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getSessionIdFromAccessToken(accessToken: string | null | undefined): string | null {
  const payload = decodeAccessTokenPayload(accessToken);
  const sessionId = payload?.session_id;
  return typeof sessionId === "string" && sessionId ? sessionId : null;
}

export function buildLoginContext(headers: HeaderLike): LoginContext {
  const userAgent = headers.get("user-agent") ?? "";
  const parsed = parseUserAgent(userAgent);
  const forwarded = headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : headers.get("x-real-ip") ?? "unknown";
  const geo: GeoInfo = {
    city: headers.get("x-vercel-ip-city"),
    region: headers.get("x-vercel-ip-country-region"),
    country: headers.get("x-vercel-ip-country"),
  };
  return {
    ip,
    userAgent,
    browser: parsed.browser,
    os: parsed.os,
    device: deviceLabel(parsed),
    deviceType: parsed.deviceType,
    geo,
    location: locationLabel(geo),
    uaKey: normalizeUserAgentKey(userAgent),
  };
}

function metaGeo(meta: unknown): { city?: unknown; region?: unknown; country?: unknown } {
  if (meta && typeof meta === "object") {
    const record = meta as Record<string, unknown>;
    return {
      city: record.city,
      region: record.region,
      country: record.country,
    };
  }
  return {};
}

function sameGeo(ctx: LoginContext, meta: unknown): boolean {
  const stored = metaGeo(meta);
  const current = {
    city: ctx.geo.city?.toLowerCase() ?? "",
    region: ctx.geo.region?.toLowerCase() ?? "",
    country: ctx.geo.country?.toLowerCase() ?? "",
  };
  const target = {
    city: typeof stored.city === "string" ? stored.city.toLowerCase() : "",
    region: typeof stored.region === "string" ? stored.region.toLowerCase() : "",
    country: typeof stored.country === "string" ? stored.country.toLowerCase() : "",
  };
  if (current.city && target.city) return current.city === target.city && current.country === target.country;
  if (current.country && target.country) return current.country === target.country;
  return current.region !== "" && target.region !== "" ? current.region === target.region : false;
}

/**
 * Called after a successful login (password sign-in, OAuth or magic-link
 * callback). Records the device/location enrichment for the GoTrue session,
 * detects sign-ins from an unrecognized device or location and raises an
 * in-app security alert. Never throws - a failure here must not block login.
 */
export async function registerLoginSecurity(opts: {
  userId: string;
  accessToken?: string | null;
  headers: HeaderLike;
  logLogin?: "always" | "existing";
}): Promise<{ suspicious: boolean; hasPriorLogins: boolean }> {
  const { userId, accessToken, headers, logLogin = "always" } = opts;
  const result = { suspicious: false, hasPriorLogins: false };

  try {
    const ctx = buildLoginContext(headers);
    const sessionId = getSessionIdFromAccessToken(accessToken);
    const now = new Date().toISOString();
    const since = new Date(Date.now() - LOGIN_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();

    if (sessionId) {
      await admin.from("user_sessions").upsert(
        {
          user_id: userId,
          auth_session_id: sessionId,
          user_agent: ctx.userAgent,
          browser: ctx.browser,
          os: ctx.os,
          device: ctx.device,
          device_type: ctx.deviceType,
          city: ctx.geo.city,
          region: ctx.geo.region,
          country: ctx.geo.country,
          last_seen_at: now,
          updated_at: now,
        },
        { onConflict: "auth_session_id" }
      );
    }

    const { data: priorLogs } = await admin
      .from("logs")
      .select("user_agent, meta")
      .eq("user_id", userId)
      .eq("action", "login")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);

    const prior = priorLogs ?? [];
    result.hasPriorLogins = prior.length > 0;

    if (result.hasPriorLogins) {
      const sameDevice = prior.some((log) => normalizeUserAgentKey(log.user_agent) === ctx.uaKey);
      const priorGeo = prior.some((log) => {
        const stored = metaGeo(log.meta);
        return Boolean(stored.city || stored.country || stored.region);
      });
      const hasGeo = Boolean(ctx.geo.city || ctx.geo.country || ctx.geo.region);

      if (!sameDevice) {
        result.suspicious = true;
      } else if (hasGeo && priorGeo) {
        const seenHere = prior.some((log) => sameGeo(ctx, log.meta));
        if (!seenHere) result.suspicious = true;
      }
    }

    if (logLogin === "always" || (logLogin === "existing" && result.hasPriorLogins)) {
      await writeLoginLog({ userId, ctx, suspicious: result.suspicious });
    }

    if (result.suspicious) {
      const location = ctx.geo.city || ctx.geo.country || ctx.geo.region;
      const body = location
        ? `${ctx.device} signed in from ${ctx.location}.`
        : `${ctx.device} signed in.`;

      await admin.from("notifications").insert({
        user_id: userId,
        type: "security_alert",
        title: "New sign-in detected",
        body,
        link: "/settings",
      });

      const { writeLog } = await import("@/lib/audit");
      await writeLog({
        userId,
        action: "security_alert",
        entityType: "profiles",
        entityId: userId,
        description: `New sign-in from unrecognized device/location: ${body}`,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        meta: {
          suspicious: true,
          device: ctx.device,
          browser: ctx.browser,
          os: ctx.os,
          city: ctx.geo.city,
          region: ctx.geo.region,
          country: ctx.geo.country,
        },
      });
    }
  } catch {
    // Security bookkeeping must never break authentication.
  }

  return result;
}

async function writeLoginLog(opts: {
  userId: string;
  ctx: LoginContext;
  suspicious: boolean;
}): Promise<void> {
  const { userId, ctx, suspicious } = opts;
  const { writeLog } = await import("@/lib/audit");
  await writeLog({
    userId,
    action: "login",
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    meta: {
      device: ctx.device,
      browser: ctx.browser,
      os: ctx.os,
      deviceType: ctx.deviceType,
      city: ctx.geo.city,
      region: ctx.geo.region,
      country: ctx.geo.country,
      suspicious,
    },
  });
}

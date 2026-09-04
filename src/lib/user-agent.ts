export interface DeviceInfo {
  browser: string;
  os: string;
  deviceType: "mobile" | "tablet" | "desktop";
}

export interface GeoInfo {
  city: string | null;
  region: string | null;
  country: string | null;
}

const COUNTRY_NAMES: Record<string, string> = {
  BD: "Bangladesh",
  IN: "India",
  PK: "Pakistan",
  NP: "Nepal",
  LK: "Sri Lanka",
  US: "United States",
  GB: "United Kingdom",
  CA: "Canada",
  AU: "Australia",
  DE: "Germany",
  FR: "France",
  IT: "Italy",
  ES: "Spain",
  NL: "Netherlands",
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  QA: "Qatar",
  KW: "Kuwait",
  BH: "Bahrain",
  OM: "Oman",
  MY: "Malaysia",
  SG: "Singapore",
  ID: "Indonesia",
  TH: "Thailand",
  PH: "Philippines",
  VN: "Vietnam",
  TR: "Turkey",
  RU: "Russia",
  UA: "Ukraine",
  BR: "Brazil",
  MX: "Mexico",
  ZA: "South Africa",
  NG: "Nigeria",
  EG: "Egypt",
  JP: "Japan",
  KR: "South Korea",
  CN: "China",
};

export function countryName(code: string | null | undefined): string | null {
  if (!code) return null;
  const upper = code.toUpperCase();
  return COUNTRY_NAMES[upper] ?? upper;
}

export function parseUserAgent(ua: string | null | undefined): DeviceInfo {
  const raw = (ua ?? "").toLowerCase();

  let browser = "Unknown browser";
  let os = "Unknown OS";
  let deviceType: DeviceInfo["deviceType"] = "desktop";

  const isMobile = /iphone|ipod|android.*mobile|windows phone|blackberry/i.test(raw);
  const isTablet = /ipad|tablet|android(?!.*mobile)|kindle|silk/i.test(raw);

  if (isTablet) deviceType = "tablet";
  else if (isMobile) deviceType = "mobile";

  if (/edg\//i.test(raw) || /edge\//i.test(raw)) {
    browser = "Edge";
  } else if (/opr\/|opera\//i.test(raw)) {
    browser = "Opera";
  } else if (/chrome|crios\//i.test(raw)) {
    browser = "Chrome";
  } else if (/samsungbrowser/i.test(raw)) {
    browser = "Samsung Internet";
  } else if (/firefox|fxios/i.test(raw)) {
    browser = "Firefox";
  } else if (/safari/i.test(raw)) {
    browser = "Safari";
  }

  if (/windows nt 10/i.test(raw)) os = "Windows 10/11";
  else if (/windows nt 6\.3/i.test(raw)) os = "Windows 8.1";
  else if (/windows nt 6\.1/i.test(raw)) os = "Windows 7";
  else if (/android/i.test(raw)) os = "Android";
  else if (/iphone|ipod/i.test(raw)) os = "iOS";
  else if (/ipad/i.test(raw)) os = "iPadOS";
  else if (/mac os x|macintosh/i.test(raw)) os = "macOS";
  else if (/linux/i.test(raw)) os = "Linux";
  else if (/cros/i.test(raw)) os = "Chrome OS";

  return { browser, os, deviceType };
}

export function deviceLabel(info: DeviceInfo): string {
  if (info.browser === "Unknown browser" && info.os === "Unknown OS") return "Unknown device";
  if (info.browser === "Unknown browser") return info.os;
  if (info.os === "Unknown OS") return info.browser;
  return `${info.browser} on ${info.os}`;
}

export function locationLabel(geo: GeoInfo): string {
  const parts: string[] = [];
  if (geo.city) parts.push(geo.city);
  if (geo.region && geo.region !== geo.city) parts.push(geo.region);
  const country = countryName(geo.country);
  if (country) parts.push(country);
  return parts.length > 0 ? parts.join(", ") : "Unknown location";
}

export function normalizeUserAgentKey(ua: string | null | undefined): string {
  const info = parseUserAgent(ua);
  return `${info.browser}|${info.os}|${info.deviceType}`;
}

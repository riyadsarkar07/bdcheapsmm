import {
  SiFacebook,
  SiInstagram,
  SiYoutube,
  SiTiktok,
  SiX,
  SiTelegram,
  SiSpotify,
  SiSoundcloud,
  SiThreads,
  SiDiscord,
  SiWhatsapp,
  SiShopee,
} from "react-icons/si";
import { Linkedin, Globe, Sparkles } from "lucide-react";

const BRAND_MAP: Record<
  string,
  { Icon: React.ComponentType<{ className?: string; color?: string }>; color?: string }
> = {
  facebook: { Icon: SiFacebook, color: "#1877F2" },
  instagram: { Icon: SiInstagram, color: "#E4405F" },
  youtube: { Icon: SiYoutube, color: "#FF0000" },
  tiktok: { Icon: SiTiktok },
  twitter: { Icon: SiX },
  telegram: { Icon: SiTelegram, color: "#26A5E4" },
  spotify: { Icon: SiSpotify, color: "#1DB954" },
  soundcloud: { Icon: SiSoundcloud, color: "#FF5500" },
  threads: { Icon: SiThreads },
  discord: { Icon: SiDiscord, color: "#5865F2" },
  whatsapp: { Icon: SiWhatsapp, color: "#25D366" },
  shopee: { Icon: SiShopee, color: "#EE4D2D" },
  linkedin: { Icon: Linkedin, color: "#0A66C2" },
};

/**
 * Renders the real brand logo for a platform slug. Platforms whose brand is
 * dark (TikTok, X, Threads) inherit `currentColor` so they stay visible in
 * both light and dark themes. Unknown slugs fall back to a generic icon.
 */
export function PlatformLogo({
  slug,
  className,
  color,
}: {
  slug: string;
  className?: string;
  color?: string;
}) {
  const entry = BRAND_MAP[slug];
  if (!entry) {
    return slug === "traffic" ? (
      <Globe className={className} />
    ) : (
      <Sparkles className={className} />
    );
  }
  const Icon = entry.Icon;
  return <Icon className={className} color={color ?? entry.color ?? "currentColor"} />;
}

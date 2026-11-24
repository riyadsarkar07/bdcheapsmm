import { exampleLinkForPlatform, PLATFORM_LABELS } from "./pricing";

const hosts: Record<string, string[]> = {
  facebook: ["facebook.com", "fb.com", "fb.watch", "fb.me"],
  instagram: ["instagram.com", "instagr.am"], youtube: ["youtube.com", "youtu.be", "youtube-nocookie.com"],
  twitter: ["x.com", "twitter.com", "t.co"], tiktok: ["tiktok.com"],
  telegram: ["t.me", "telegram.me", "telegram.dog"], spotify: ["spotify.com", "spotify.link", "spoti.fi"],
  soundcloud: ["soundcloud.com", "snd.sc"], threads: ["threads.net", "threads.com"],
  discord: ["discord.com", "discord.gg", "discordapp.com"], whatsapp: ["whatsapp.com", "wa.me"],
  linkedin: ["linkedin.com", "lnkd.in"],
};

export function targetExample(platform: string, serviceType: string | null) {
  if (platform === "instagram" && serviceType === "followers") return "https://www.instagram.com/username/";
  if (platform === "youtube" && serviceType === "subscribers") return "https://www.youtube.com/@channel";
  if (platform === "tiktok" && serviceType === "followers") return "https://www.tiktok.com/@username";
  if (platform === "facebook" && ["views", "comment", "shares"].includes(serviceType ?? "")) return "https://www.facebook.com/yourpage/posts/123";
  return exampleLinkForPlatform(platform);
}

export function targetLinkError(input: string, platform: string) {
  let url: URL;
  try { url = new URL(input); } catch { return "Enter a valid http or https link."; }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return "Enter a valid http or https link.";
  const allowed = hosts[platform];
  if (allowed && !allowed.some(host => url.hostname === host || url.hostname.endsWith("." + host))) {
    return `Use a ${PLATFORM_LABELS[platform]} link for this service.`;
  }
  return null;
}

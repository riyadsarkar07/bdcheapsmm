import type { Category } from "@/lib/types/database";
import {
  Instagram,
  Facebook,
  Youtube,
  Music2,
  Twitter,
  Send,
  MessageCircle,
  Headphones,
  Sparkles,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Instagram,
  Facebook,
  Youtube,
  Music2,
  Twitter,
  Send,
  MessageCircle,
  Headphones,
  Sparkles,
};

export function CategoryIcon({
  icon,
  className,
}: {
  icon: Category["icon"];
  className?: string;
}) {
  const Icon = (icon && ICON_MAP[icon]) || Sparkles;
  return <Icon className={className} />;
}

export function categoryName(category: Pick<Category, "name"> | null | undefined): string {
  return category?.name ?? "General";
}

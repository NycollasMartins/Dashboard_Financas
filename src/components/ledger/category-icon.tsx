import {
  Baby, Banknote, Bike, BookOpen, Briefcase, Bus, Car, Circle, CirclePlus, Coffee, CreditCard, Dumbbell, Ellipsis,
  Fuel, Gamepad2, Gift, GraduationCap, HandCoins, HeartPulse, House, Landmark, Laptop, Music, PartyPopper, PawPrint,
  PiggyBank, Pill, Plane, Receipt, Repeat, RotateCcw, Shirt, ShoppingBag, ShoppingCart, Smartphone, Sparkles,
  Stethoscope, Target, TrendingUp, Tv, Utensils, Wifi, Wrench, Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Ícones disponíveis para categorias (nome salvo no banco → componente). */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  house: House, "shopping-cart": ShoppingCart, utensils: Utensils, car: Car, receipt: Receipt, repeat: Repeat,
  "heart-pulse": HeartPulse, "graduation-cap": GraduationCap, "party-popper": PartyPopper, "shopping-bag": ShoppingBag,
  sparkles: Sparkles, "paw-print": PawPrint, plane: Plane, gift: Gift, landmark: Landmark, ellipsis: Ellipsis,
  briefcase: Briefcase, laptop: Laptop, "trending-up": TrendingUp, "rotate-ccw": RotateCcw, "circle-plus": CirclePlus,
  circle: Circle, coffee: Coffee, fuel: Fuel, bus: Bus, bike: Bike, wifi: Wifi, zap: Zap, smartphone: Smartphone,
  tv: Tv, music: Music, "gamepad-2": Gamepad2, dumbbell: Dumbbell, pill: Pill, stethoscope: Stethoscope, baby: Baby,
  shirt: Shirt, "book-open": BookOpen, wrench: Wrench, "piggy-bank": PiggyBank, banknote: Banknote,
  "hand-coins": HandCoins, "credit-card": CreditCard, target: Target,
};

export function CategoryIcon({
  icon,
  color,
  className,
  size = "md",
}: {
  icon?: string | null;
  color?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const Icon = (icon && CATEGORY_ICONS[icon]) || Circle;
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-xl",
        size === "sm" && "size-8 rounded-lg",
        size === "md" && "size-10",
        size === "lg" && "size-12 rounded-2xl",
        className,
      )}
      style={{ backgroundColor: `color-mix(in oklch, ${color ?? "#94a3b8"} 18%, transparent)`, color: color ?? undefined }}
    >
      <Icon className={cn(size === "sm" ? "size-4" : "size-5")} />
    </span>
  );
}

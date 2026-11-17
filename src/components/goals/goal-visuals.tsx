import {
  AlertTriangle, Baby, Car, CheckCircle2, Clock, Gauge, Gift, GraduationCap, Heart, House, Laptop, PiggyBank,
  Plane, Rocket, Shield, Sparkles, Target, type LucideIcon,
} from "lucide-react";
import { CATEGORY_ICONS } from "@/components/ledger/category-icon";
import { PACE_LABEL, type PaceStatus } from "@/lib/goals/math";
import { cn } from "@/lib/utils";

/** Anel de progresso (SVG sem ids: pode repetir na página). */
export function GoalRing({
  pct,
  color,
  size = 64,
  stroke = 7,
  children,
  label,
}: {
  pct: number;
  color: string;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, pct));
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(clamped * 100)}% concluído`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function GoalIcon({ icon, color, className }: { icon: string; color: string; className?: string }) {
  const Icon: LucideIcon = GOAL_ICONS_MAP[icon] ?? (CATEGORY_ICONS[icon] as LucideIcon | undefined) ?? Target;
  return <Icon className={cn("size-5", className)} style={{ color }} aria-hidden />;
}

export const GOAL_ICONS_MAP: Record<string, LucideIcon> = {
  target: Target, car: Car, plane: Plane, shield: Shield, house: House, "graduation-cap": GraduationCap,
  heart: Heart, gift: Gift, laptop: Laptop, baby: Baby, "piggy-bank": PiggyBank, sparkles: Sparkles,
};

const PACE_STYLE: Record<PaceStatus, { cls: string; icon: LucideIcon }> = {
  done: { cls: "bg-income-muted text-income", icon: CheckCircle2 },
  ahead: { cls: "bg-income-muted text-income", icon: Rocket },
  on_track: { cls: "bg-primary/12 text-primary", icon: Gauge },
  behind: { cls: "bg-warning/15 text-warning", icon: AlertTriangle },
  no_deadline: { cls: "bg-muted text-muted-foreground", icon: Clock },
  no_pace: { cls: "bg-muted text-muted-foreground", icon: Clock },
};

/** Status do ritmo: cor + ícone + texto (nunca só cor). */
export function PaceBadge({ status, deltaMonths, className }: { status: PaceStatus; deltaMonths?: number | null; className?: string }) {
  const s = PACE_STYLE[status];
  const extra =
    status === "behind" && deltaMonths ? ` ${deltaMonths} ${deltaMonths === 1 ? "mês" : "meses"}` :
    status === "ahead" && deltaMonths ? ` ${-deltaMonths} ${deltaMonths === -1 ? "mês" : "meses"}` : "";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold", s.cls, className)}>
      <s.icon aria-hidden className="size-3.5" />
      {PACE_LABEL[status]}{extra}
    </span>
  );
}

const monthYear = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" });
/** "2029-03-31" → "mar. de 2029" → "mar/2029" */
export function shortMonth(iso: string | null) {
  if (!iso) return "—";
  const [y, m] = iso.split("-").map(Number);
  return monthYear.format(new Date(Date.UTC(y, m - 1, 1))).replace(". de ", "/").replace(" de ", "/");
}

import {
  CreditCard,
  LayoutDashboard,
  ListOrdered,
  Settings,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Fase em que a tela ganha conteúdo real (mostra selo "em breve"). */
  comingInPhase?: number;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/painel", label: "Painel", icon: LayoutDashboard },
  { href: "/lancamentos", label: "Lançamentos", icon: ListOrdered, comingInPhase: 2 },
  { href: "/cartoes", label: "Cartões", icon: CreditCard, comingInPhase: 2 },
  { href: "/metas", label: "Metas", icon: Target, comingInPhase: 4 },
  { href: "/familia", label: "Família", icon: Users },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

/** Barra inferior do celular: 4 itens + botão central de lançamento. */
export const MOBILE_NAV: NavItem[] = [NAV_ITEMS[0], NAV_ITEMS[1], NAV_ITEMS[3], NAV_ITEMS[4]];

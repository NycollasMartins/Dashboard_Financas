import {
  Bell,
  Compass,
  CreditCard,
  Ellipsis,
  LayoutDashboard,
  ListOrdered,
  MessageCircle,
  Repeat,
  Settings,
  Tags,
  Target,
  Users,
  Wallet,
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
  { href: "/lancamentos", label: "Lançamentos", icon: ListOrdered },
  { href: "/cartoes", label: "Cartões", icon: CreditCard },
  { href: "/contas", label: "Contas", icon: Wallet },
  { href: "/recorrencias", label: "Recorrências", icon: Repeat },
  { href: "/categorias", label: "Categorias", icon: Tags },
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/planejamento", label: "Planejamento", icon: Compass },
  { href: "/assistente", label: "Assistente", icon: MessageCircle },
  { href: "/notificacoes", label: "Notificações", icon: Bell },
  { href: "/familia", label: "Família", icon: Users },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

const byHref = (h: string) => NAV_ITEMS.find((i) => i.href === h)!;

/** Barra inferior do celular: 4 itens + botão central de lançamento. Metas é o coração do produto (Fase 4). */
export const MOBILE_NAV: NavItem[] = [
  byHref("/painel"),
  byHref("/lancamentos"),
  byHref("/metas"),
  { href: "/mais", label: "Mais", icon: Ellipsis },
];

/** Itens que ficam na tela "Mais" do celular. */
export const MORE_ITEMS: NavItem[] = NAV_ITEMS.filter(
  (i) => !["/painel", "/lancamentos", "/metas"].includes(i.href),
);

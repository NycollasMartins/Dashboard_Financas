import Link from "next/link";
import { AlertTriangle, CalendarClock, CreditCard, Receipt, Trophy, Users, Wallet } from "lucide-react";
import { CategoryIcon } from "@/components/ledger/category-icon";
import { Money } from "@/components/money";
import { initials } from "@/lib/initials";
import { cn } from "@/lib/utils";
import { SectionEmpty } from "./categories";

const dayMonth = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });
function dateChip(iso: string) {
  const [d, m] = dayMonth.format(new Date(`${iso}T12:00:00Z`)).replace(".", "").split(" de ");
  return { d, m };
}

function Card({ id, title, description, children, className }: { id: string; title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-labelledby={`${id}-title`} className={cn("grid min-w-0 content-start gap-3 rounded-2xl border bg-card p-4 animate-rise sm:p-5", className)}>
      <header>
        <h2 id={`${id}-title`} className="text-base font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </header>
      {children}
    </section>
  );
}

export type UpcomingView = {
  type: "bill" | "invoice";
  id: string;
  dueOn: string;
  description: string;
  amountCents: number;
  isOverdue: boolean;
  href: string;
  category?: { icon: string; color: string } | null;
  cardColor?: string | null;
};

export function UpcomingList({ items, today }: { items: UpcomingView[]; today: string }) {
  return (
    <Card id="vencimentos" title="Próximos vencimentos" description="Contas previstas e faturas dos próximos 15 dias (e as vencidas).">
      {items.length === 0 ? (
        <SectionEmpty icon={CalendarClock} text="Nada vencendo nos próximos 15 dias." />
      ) : (
        <ul className="grid gap-1">
          {items.map((it) => {
            const { d, m } = dateChip(it.dueOn);
            const isToday = it.dueOn === today;
            return (
              <li key={`${it.type}-${it.id}`}>
                <Link href={it.href} className="flex min-h-14 items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-accent/60">
                  <span className={cn(
                    "grid w-11 shrink-0 justify-items-center rounded-lg border py-1 leading-tight",
                    it.isOverdue && "border-destructive/50 bg-destructive/10 text-destructive",
                    isToday && !it.isOverdue && "border-primary/50 text-primary",
                  )}>
                    <span className="text-sm font-semibold">{d}</span>
                    <span className="text-[10px] uppercase">{m}</span>
                  </span>
                  <span className="grid min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                      {it.type === "invoice" ? (
                        <CreditCard aria-hidden className="size-3.5 shrink-0" style={{ color: it.cardColor ?? undefined }} />
                      ) : (
                        <Receipt aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate">{it.type === "invoice" ? `Fatura ${it.description}` : it.description}</span>
                    </span>
                    <span className={cn("text-xs text-muted-foreground", it.isOverdue && "font-medium text-destructive")}>
                      {it.isOverdue ? (
                        <span className="inline-flex items-center gap-1"><AlertTriangle aria-hidden className="size-3" /> Vencida</span>
                      ) : isToday ? "Vence hoje" : it.type === "invoice" ? "Fatura do cartão" : "Conta prevista"}
                    </span>
                  </span>
                  <Money cents={it.amountCents} className="shrink-0 text-sm font-semibold" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export type TopExpenseView = {
  id: string;
  description: string;
  amountCents: number;
  occurredOn: string;
  installment: string | null;
  isPlanned: boolean;
  category: { name: string; icon: string; color: string } | null;
};

export function TopExpenses({ items, hrefAll }: { items: TopExpenseView[]; hrefAll: string }) {
  return (
    <Card id="maiores" title="Maiores gastos" description="Os 5 maiores lançamentos do período.">
      {items.length === 0 ? (
        <SectionEmpty icon={Trophy} text="Nenhuma despesa neste período." />
      ) : (
        <>
          <ol className="grid gap-1">
            {items.map((t) => {
              const { d, m } = dateChip(t.occurredOn);
              return (
                <li key={t.id} className="flex min-h-12 items-center gap-3 px-2 py-1">
                  <CategoryIcon icon={t.category?.icon} color={t.category?.color} size="sm" />
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate text-sm font-medium">
                      {t.description}
                      {t.installment && <span className="ml-1.5 rounded bg-muted px-1 text-[10px] font-semibold text-muted-foreground">{t.installment}</span>}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {t.category?.name ?? "Sem categoria"} · {d} {m}{t.isPlanned && " · previsto"}
                    </span>
                  </span>
                  <Money cents={t.amountCents} className="shrink-0 text-sm font-semibold" />
                </li>
              );
            })}
          </ol>
          <Link href={hrefAll} className="flex h-11 items-center justify-center rounded-xl text-sm font-medium text-primary hover:bg-accent">
            Ver todos os lançamentos
          </Link>
        </>
      )}
    </Card>
  );
}

export type MeterRow = { id: string; name: string; valueCents: number; color?: string | null; sub?: React.ReactNode; avatar?: boolean; href?: string };

/** Lista de medidores: nome, barra (fração do maior) e valor. */
export function MeterList({
  id,
  title,
  description,
  rows,
  emptyText,
  icon,
}: {
  id: string;
  title: string;
  description?: string;
  rows: MeterRow[];
  emptyText: string;
  icon: "members" | "sources";
}) {
  const max = Math.max(1, ...rows.map((r) => r.valueCents));
  const total = rows.reduce((a, r) => a + r.valueCents, 0);
  return (
    <Card id={id} title={title} description={description}>
      {rows.length === 0 || total === 0 ? (
        <SectionEmpty icon={icon === "members" ? Users : Wallet} text={emptyText} />
      ) : (
        <ul className="grid gap-3">
          {rows.map((r, i) => {
            const content = (
              <>
                {r.avatar ? (
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-savings-muted text-xs font-semibold text-savings">{initials(r.name, "")}</span>
                ) : (
                  <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: r.color ?? "var(--muted-foreground)" }} />
                )}
                <span className="grid min-w-0 flex-1 gap-1">
                  <span className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{r.name}</span>
                    <Money cents={r.valueCents} className="shrink-0 font-semibold" />
                  </span>
                  <span aria-hidden className="block h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <span className="block h-full origin-left rounded-full bg-viz-expense animate-grow-x"
                      style={{ width: `${(r.valueCents / max) * 100}%`, animationDelay: `${i * 40}ms` }} />
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {Math.round((r.valueCents / total) * 100)}% do total{r.sub ? <> · {r.sub}</> : null}
                  </span>
                </span>
              </>
            );
            return (
              <li key={r.id}>
                {r.href ? (
                  <Link href={r.href} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-1 hover:bg-accent/60">{content}</Link>
                ) : (
                  <div className="flex items-center gap-3">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export type CardLimitView = { id: string; name: string; color: string | null; usedCents: number; limitCents: number | null; availableCents: number | null };

/** Uso do limite de cada cartão (medidor; ≥ 80% ganha aviso com ícone + texto). */
export function CardLimits({ cards }: { cards: CardLimitView[] }) {
  return (
    <Card id="limites" title="Uso do limite dos cartões" description="Inclui parcelas futuras já lançadas.">
      {cards.length === 0 ? (
        <SectionEmpty icon={CreditCard} text="Nenhum cartão cadastrado.">
          <Link href="/cartoes" className="text-sm font-medium text-primary">Cadastrar cartão</Link>
        </SectionEmpty>
      ) : (
        <ul className="grid gap-4">
          {cards.map((c, i) => {
            const usage = c.limitCents ? Math.min(1, c.usedCents / c.limitCents) : null;
            const high = usage !== null && usage >= 0.8;
            return (
              <li key={c.id}>
                <Link href={`/cartoes/${c.id}`} className="-mx-2 grid gap-1.5 rounded-xl px-2 py-1 hover:bg-accent/60">
                  <span className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2 font-medium">
                      <CreditCard aria-hidden className="size-4 shrink-0" style={{ color: c.color ?? undefined }} />
                      <span className="truncate">{c.name}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {usage === null ? "sem limite" : `${Math.round(usage * 100)}% usado`}
                    </span>
                  </span>
                  {usage !== null && (
                    <span role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(usage * 100)}
                      aria-label={`Uso do limite do ${c.name}`} className="block h-2 overflow-hidden rounded-full bg-surface-2">
                      <span className="block h-full origin-left rounded-full animate-grow-x"
                        style={{ width: `${usage * 100}%`, background: high ? "var(--warning)" : (c.color ?? "var(--primary)"), animationDelay: `${i * 50}ms` }} />
                    </span>
                  )}
                  <span className="flex flex-wrap justify-between gap-x-3 text-[11px] text-muted-foreground">
                    <span>Usado <Money cents={c.usedCents} /></span>
                    {c.availableCents !== null && (
                      <span className={cn(high && "font-medium text-warning")}>
                        {high && <AlertTriangle aria-hidden className="mr-1 inline size-3" />}
                        Disponível <Money cents={c.availableCents} />
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

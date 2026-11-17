import type { Metadata } from "next";
import { Suspense } from "react";
import { ArrowDownRight, ArrowUpRight, LineChart, PiggyBank, Scale } from "lucide-react";
import { CategoryBreakdown, AverageComparison, SectionEmpty } from "@/components/dashboard/categories";
import { DashboardNavProvider, DashboardToolbar, PendingArea } from "@/components/dashboard/dashboard-nav";
import { InsightsCard } from "@/components/dashboard/insights";
import { KpiCard, PositionStrip, ProjectionCard } from "@/components/dashboard/kpis";
import { CardLimits, MeterList, TopExpenses, UpcomingList } from "@/components/dashboard/lists";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { NewEntryButton } from "@/components/ledger/new-entry-button";
import { PageHeader } from "@/components/page-header";
import { PrivacyToggle } from "@/components/privacy/privacy";
import { Skeleton } from "@/components/ui/skeleton";
import { savingsRate } from "@/lib/analytics/delta";
import { buildInsights } from "@/lib/analytics/insights";
import { isCurrent, resolvePeriod, type Period } from "@/lib/analytics/period";
import { getByMember, getBySource, getTopExpenses, type AnalyticsScope } from "@/lib/data/analytics";
import { getLedgerLookups, type LedgerLookups } from "@/lib/data/ledger";
import { formatMonthTitle, todayISO, type ISODate } from "@/lib/dates";
import { BASIS_FROM_PARAM, BASIS_LABEL } from "@/lib/domain/basis";
import { parseDashboardFilters } from "@/lib/validation/analytics";
import { getWorkspaceContext } from "@/lib/workspaces/context";
import { loadCategoryTree, loadMonthly, loadPosition, loadTotals, loadUpcoming } from "./load";

export const metadata: Metadata = { title: "Painel" };

/*
 * Painel (Fase 3). Layout mobile-first (docs/design-system.md → "Dashboard"):
 *   filtros → saldo projetado → KPIs → posição → insights →
 *   categorias | vencimentos → evolução 12 meses → média | limites →
 *   maiores gastos | por membro | por meio de pagamento.
 * Cada bloco tem seu <Suspense>: o topo aparece primeiro e o resto vai chegando.
 */
export default function DashboardPage(props: PageProps<"/painel">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard searchParams={props.searchParams} />
    </Suspense>
  );
}

type Ctx = {
  scope: AnalyticsScope;
  period: Period;
  today: ISODate;
  lookups: LedgerLookups;
  basisLabel: string;
  ledgerHref: (extra?: Record<string, string>) => string;
  household: boolean;
};

async function Dashboard({ searchParams }: { searchParams: PageProps<"/painel">["searchParams"] }) {
  const [{ user, active }, sp] = await Promise.all([getWorkspaceContext(), searchParams]);
  const filters = parseDashboardFilters(sp);
  const today = todayISO();
  const period = resolvePeriod(filters, today);
  const basisParam = filters.visao ?? "competencia";
  const basis = BASIS_FROM_PARAM[basisParam];
  const lookups = await getLedgerLookups(active.id, user.id);
  const scope: AnalyticsScope = {
    workspaceId: active.id,
    basis,
    categoryId: filters.categoria,
    memberId: filters.membro,
    accountId: filters.conta,
    cardId: filters.cartao,
  };
  // Lista de lançamentos filtrada (ela trabalha por mês: usamos o mês do período
  // ou, para ano/intervalo, o último mês até hoje).
  const ledgerMonth = (period.kind === "month" ? period.from : (period.to < today ? period.to : today)).slice(0, 7);
  const ledgerHref = (extra: Record<string, string> = {}) => {
    const q = new URLSearchParams({ mes: ledgerMonth });
    if (filters.membro) q.set("membro", filters.membro);
    if (filters.conta) q.set("conta", filters.conta);
    if (filters.cartao) q.set("cartao", filters.cartao);
    if (filters.categoria) q.set("categoria", filters.categoria);
    for (const [k, v] of Object.entries(extra)) q.set(k, v);
    return `/lancamentos?${q.toString()}`;
  };
  const ctx: Ctx = {
    scope,
    period,
    today,
    lookups,
    basisLabel: BASIS_LABEL[basis],
    ledgerHref,
    household: active.kind === "household" && lookups.members.length > 1,
  };
  const firstName = user.fullName.split(" ")[0] || "por aqui";

  return (
    <>
      <PageHeader
        eyebrow={active.kind === "personal" ? "Espaço individual" : `Família · ${active.name}`}
        title={`Olá, ${firstName}`}
        actions={<PrivacyToggle className="hidden lg:grid" />}
        className="mb-4 lg:mb-6"
      />
      <DashboardNavProvider>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:gap-5">
          <DashboardToolbar
            kind={period.kind}
            from={period.from}
            to={period.to}
            label={period.label}
            basis={basisParam}
            categories={lookups.categories.filter((c) => !c.archived).map((c) => ({ id: c.id, name: c.name, kind: c.kind, parentId: c.parentId }))}
            members={lookups.members.map((m) => ({ id: m.id, name: m.name }))}
            accounts={lookups.accounts.map((a) => ({ id: a.id, name: a.name }))}
            cards={lookups.cards.map((c) => ({ id: c.id, name: c.name }))}
          />
          <PendingArea>
            <Suspense fallback={<OverviewSkeleton />}>
              <Overview ctx={ctx} />
            </Suspense>
            <Suspense fallback={null}>
              <Insights ctx={ctx} />
            </Suspense>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start lg:gap-5">
              <Suspense fallback={<BlockSkeleton h="h-96" />}>
                <Categories ctx={ctx} />
              </Suspense>
              <Suspense fallback={<BlockSkeleton h="h-72" />}>
                <Upcoming ctx={ctx} />
              </Suspense>
            </div>
            <Suspense fallback={<BlockSkeleton h="h-80" />}>
              <Trend ctx={ctx} />
            </Suspense>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2 lg:items-start lg:gap-5">
              <Suspense fallback={<BlockSkeleton h="h-72" />}>
                <Comparison ctx={ctx} />
              </Suspense>
              <CardLimits
                cards={lookups.cards
                  .filter((c) => !filters.cartao || c.id === filters.cartao)
                  .map((c) => ({ id: c.id, name: c.name, color: c.color, usedCents: c.usedCents, limitCents: c.limitCents, availableCents: c.availableCents }))}
              />
            </div>
            <div className={`grid grid-cols-[minmax(0,1fr)] gap-4 lg:gap-5 ${ctx.household ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
              <Suspense fallback={<BlockSkeleton h="h-72" />}>
                <Top ctx={ctx} />
              </Suspense>
              {ctx.household && (
                <Suspense fallback={<BlockSkeleton h="h-72" />}>
                  <Members ctx={ctx} />
                </Suspense>
              )}
              <Suspense fallback={<BlockSkeleton h="h-72" />}>
                <Sources ctx={ctx} />
              </Suspense>
            </div>
          </PendingArea>
        </div>
      </DashboardNavProvider>
    </>
  );
}

const prevLabelOf = (p: Period) =>
  p.kind === "month" ? formatMonthTitle(p.previous.from).toLowerCase() : p.kind === "year" ? p.previous.from.slice(0, 4) : "o período anterior";

const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

async function Overview({ ctx }: { ctx: Ctx }) {
  const { scope, period, today } = ctx;
  const [cur, prev, now, end] = await Promise.all([
    loadTotals(scope, period),
    loadTotals(scope, period.previous),
    loadPosition(scope, today),
    loadPosition(scope, period.to),
  ]);
  const prevLabel = prevLabelOf(period);
  const balance = cur.incomeCents - cur.expenseCents;
  const prevBalance = prev.incomeCents - prev.expenseCents;
  const rate = savingsRate(cur.incomeCents, cur.expenseCents);
  const prevRate = savingsRate(prev.incomeCents, prev.expenseCents);
  const empty = cur.entries === 0;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:gap-5">
      {empty && (
        <SectionEmpty icon={LineChart} text={`Nenhum lançamento em ${period.label.toLowerCase()}${scope.categoryId || scope.memberId || scope.accountId || scope.cardId ? " com estes filtros" : ""}.`}>
          <NewEntryButton label="Lançar agora" />
        </SectionEmpty>
      )}
      <section aria-label="Resumo do período" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <h2 className="sr-only">Resumo do período</h2>
        <KpiCard label="Receitas" icon={ArrowUpRight} iconClass="text-income" metric="income"
          cents={cur.incomeCents} previous={prev.incomeCents} previousLabel={prevLabel}
          planned={cur.incomePlannedCents} plannedLabel="a receber" />
        <KpiCard label="Despesas" icon={ArrowDownRight} iconClass="text-expense" metric="expense"
          cents={cur.expenseCents} previous={prev.expenseCents} previousLabel={prevLabel}
          planned={cur.expensePlannedCents} plannedLabel="previsto" />
        <KpiCard label="Saldo do período" icon={Scale} iconClass="text-primary" metric="balance" highlight
          cents={balance} previous={prevBalance} previousLabel={prevLabel} />
        <KpiCard label="Taxa de economia" icon={PiggyBank} iconClass="text-savings" metric="rate"
          rate={rate} previous={prevRate} previousLabel={prevLabel} />
      </section>
      <ProjectionCard
        isProjection={end.isProjection}
        balanceCents={end.isProjection ? now.balanceCents : end.balanceCents}
        projectedCents={end.projectedBalanceCents}
        plannedIncomeCents={end.plannedIncomeCents}
        plannedExpenseCents={end.plannedExpenseCents}
        invoicesDueCents={end.invoicesDueCents}
        untilLabel={shortDate(period.to)}
      />
      <PositionStrip
        balanceCents={now.balanceCents}
        openInvoicesCents={now.openInvoicesCents}
        availableLimitCents={now.availableLimitCents}
        limitCents={now.limitCents}
      />
    </div>
  );
}

async function Insights({ ctx }: { ctx: Ctx }) {
  const { scope, period, today, lookups } = ctx;
  const [cur, end, now, tree, upcoming] = await Promise.all([
    loadTotals(scope, period),
    loadPosition(scope, period.to),
    loadPosition(scope, today),
    loadCategoryTree(scope, period, lookups),
    loadUpcoming(scope.workspaceId),
  ]);
  const overdue = upcoming.filter((u) => u.isOverdue);
  const insights = buildInsights({
    isCurrentPeriod: isCurrent(period, today),
    incomeCents: cur.incomeCents,
    expenseCents: cur.expenseCents,
    incomePlannedCents: cur.incomePlannedCents,
    expensePlannedCents: cur.expensePlannedCents,
    projectedBalanceCents: end.isProjection ? end.projectedBalanceCents : null,
    categories: tree,
    compareToAverage: period.kind === "month",
    overdueCount: overdue.length,
    overdueCents: overdue.reduce((a, u) => a + u.amountCents, 0),
    cardUsage: now.limitCents > 0 ? (now.limitCents - now.availableLimitCents) / now.limitCents : null,
    ledgerHref: (id) => ctx.ledgerHref({ categoria: id, tipo: "expense" }),
  });
  return <InsightsCard insights={insights} />;
}

async function Categories({ ctx }: { ctx: Ctx }) {
  const tree = await loadCategoryTree(ctx.scope, ctx.period, ctx.lookups);
  const total = tree.reduce((a, n) => a + n.totalCents, 0);
  return <CategoryBreakdown nodes={tree} totalCents={total} hrefFor={(id) => ctx.ledgerHref({ categoria: id, tipo: "expense" })} />;
}

async function Comparison({ ctx }: { ctx: Ctx }) {
  const tree = await loadCategoryTree(ctx.scope, ctx.period, ctx.lookups);
  return <AverageComparison nodes={tree} months={ctx.period.months} monthOnly={ctx.period.kind !== "month"} />;
}

async function Upcoming({ ctx }: { ctx: Ctx }) {
  const items = await loadUpcoming(ctx.scope.workspaceId);
  const cats = new Map(ctx.lookups.categories.map((c) => [c.id, c]));
  const cards = new Map(ctx.lookups.cards.map((c) => [c.id, c]));
  return (
    <UpcomingList
      today={ctx.today}
      items={items.map((u) => ({
        ...u,
        href: u.type === "invoice" && u.cardId ? `/cartoes/${u.cardId}?fatura=${u.dueOn.slice(0, 7)}` : `/lancamentos?mes=${u.dueOn.slice(0, 7)}`,
        category: u.categoryId ? cats.get(u.categoryId) ?? null : null,
        cardColor: u.cardId ? cards.get(u.cardId)?.color ?? null : null,
      }))}
    />
  );
}

async function Trend({ ctx }: { ctx: Ctx }) {
  const points = await loadMonthly(ctx.scope, ctx.period.trend);
  const selected: string[] = [];
  for (const p of points) if (p.month <= ctx.period.to && p.month.slice(0, 7) >= ctx.period.from.slice(0, 7)) selected.push(p.month.slice(0, 7));
  return <TrendChart points={points} selected={selected} basisLabel={ctx.basisLabel} />;
}

async function Top({ ctx }: { ctx: Ctx }) {
  const rows = await getTopExpenses(ctx.scope, ctx.period, 5);
  const cats = new Map(ctx.lookups.categories.map((c) => [c.id, c]));
  return (
    <TopExpenses
      hrefAll={ctx.ledgerHref({ tipo: "expense" })}
      items={rows.map((r) => ({ ...r, category: r.categoryId ? cats.get(r.categoryId) ?? null : null }))}
    />
  );
}

async function Members({ ctx }: { ctx: Ctx }) {
  const rows = await getByMember(ctx.scope, ctx.period);
  const names = new Map(ctx.lookups.members.map((m) => [m.id, m.name]));
  return (
    <MeterList
      id="membros"
      title="Gastos por membro"
      description="Quem gastou (ou quem lançou, se não informado)."
      icon="members"
      emptyText="Nenhuma despesa neste período."
      rows={rows
        .filter((r) => r.expenseCents > 0)
        .map((r) => ({
          id: r.memberId ?? "none",
          name: (r.memberId && names.get(r.memberId)) || "Ex-membro",
          valueCents: r.expenseCents,
          avatar: true,
          href: r.memberId ? ctx.ledgerHref({ membro: r.memberId, tipo: "expense" }) : undefined,
        }))}
    />
  );
}

async function Sources({ ctx }: { ctx: Ctx }) {
  const rows = await getBySource(ctx.scope, ctx.period);
  const cards = new Map(ctx.lookups.cards.map((c) => [c.id, c]));
  const accounts = new Map(ctx.lookups.accounts.map((a) => [a.id, a]));
  return (
    <MeterList
      id="meios"
      title="Gastos por cartão e conta"
      description="De onde saiu o dinheiro."
      icon="sources"
      emptyText="Nenhuma despesa neste período."
      rows={rows
        .filter((r) => r.expenseCents > 0)
        .map((r) => {
          const card = r.type === "card" && r.id ? cards.get(r.id) : undefined;
          const acc = r.type === "account" && r.id ? accounts.get(r.id) : undefined;
          return {
            id: `${r.type}-${r.id}`,
            name: card?.name ?? acc?.name ?? "Sem conta",
            valueCents: r.expenseCents,
            color: card?.color ?? acc?.color ?? null,
            sub: r.type === "card" ? "cartão" : r.type === "account" ? "conta" : undefined,
            href: card ? ctx.ledgerHref({ cartao: card.id, tipo: "expense" }) : acc ? ctx.ledgerHref({ conta: acc.id, tipo: "expense" }) : undefined,
          };
        })}
    />
  );
}

function BlockSkeleton({ h }: { h: string }) {
  return <Skeleton className={`${h} rounded-2xl`} />;
}

function OverviewSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
      </div>
      <Skeleton className="h-44 rounded-2xl" />
      <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
        {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-4">
      <div className="grid gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-56" />
      </div>
      <Skeleton className="h-11 w-full rounded-xl sm:w-96" />
      <OverviewSkeleton />
    </div>
  );
}

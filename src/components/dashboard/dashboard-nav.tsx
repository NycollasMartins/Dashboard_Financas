"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useContext, useState, useTransition } from "react";
import { CalendarRange, ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { addMonths, formatMonthTitle, monthStart, todayISO, type ISODate } from "@/lib/dates";
import { cn } from "@/lib/utils";

/*
 * Navegação do dashboard: todos os filtros vivem na URL. Usamos router.push
 * (não replace) → cada mudança vira uma entrada no histórico e o botão voltar
 * desfaz o último filtro. Enquanto o servidor responde, o conteúdo anterior
 * fica visível com opacidade reduzida (sem "piscar" skeleton).
 */

type Nav = { pending: boolean; go: (patch: Record<string, string | null>) => void };
const NavContext = createContext<Nav>({ pending: false, go: () => {} });

const PERIOD_KEYS = ["periodo", "ano", "de", "ate"];
export const FILTER_KEYS = ["categoria", "membro", "conta", "cartao"] as const;

export function DashboardNavProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  function go(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    // Trocar o tipo de período apaga os outros parâmetros de período.
    if (Object.keys(patch).some((k) => PERIOD_KEYS.includes(k))) for (const k of PERIOD_KEYS) next.delete(k);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    start(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  return <NavContext value={{ pending, go }}>{children}</NavContext>;
}

export function useDashboardNav() {
  return useContext(NavContext);
}

/** Conteúdo que esmaece enquanto a próxima versão carrega. */
export function PendingArea({ children }: { children: React.ReactNode }) {
  const { pending } = useDashboardNav();
  return (
    <div aria-busy={pending || undefined} className={cn("grid grid-cols-[minmax(0,1fr)] gap-4 transition-opacity duration-200 lg:gap-5", pending && "opacity-60")}>
      {children}
    </div>
  );
}

type Option = { id: string; name: string };

export function DashboardToolbar({
  kind,
  from,
  to,
  label,
  basis,
  categories,
  members,
  accounts,
  cards,
}: {
  kind: "month" | "year" | "range";
  from: ISODate;
  to: ISODate;
  label: string;
  basis: "competencia" | "caixa";
  categories: (Option & { kind: "income" | "expense"; parentId: string | null })[];
  members: Option[];
  accounts: Option[];
  cards: Option[];
}) {
  const { go, pending } = useDashboardNav();
  const params = useSearchParams();
  const [periodOpen, setPeriodOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const active = FILTER_KEYS.filter((k) => params.get(k));

  function step(dir: -1 | 1) {
    if (kind === "month") go({ periodo: addMonths(from, dir).slice(0, 7) });
    else if (kind === "year") go({ ano: String(Number(from.slice(0, 4)) + dir) });
  }

  const select = "h-11 w-full min-w-0 rounded-lg border border-input bg-surface-2/60 px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";
  const names = (k: string) =>
    ({ categoria: categories, membro: members, conta: accounts, cartao: cards })[k]?.find((o) => o.id === params.get(k))?.name;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-2 animate-rise">
      <div className="flex flex-wrap items-center gap-2">
        {/* Período */}
        <div className="flex min-w-0 basis-full items-center rounded-xl border bg-card sm:basis-auto">
          {kind !== "range" && (
            <button type="button" onClick={() => step(-1)} aria-label={kind === "month" ? "Mês anterior" : "Ano anterior"}
              className="grid size-11 shrink-0 place-items-center rounded-l-xl hover:bg-accent">
              <ChevronLeft className="size-5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setPeriodOpen(true)}
            className="flex h-11 min-w-0 flex-1 items-center justify-center gap-2 px-2 text-sm font-semibold hover:bg-accent sm:min-w-44"
            aria-label={`Período: ${label}. Alterar período`}
          >
            <CalendarRange className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{label}</span>
          </button>
          {kind !== "range" && (
            <button type="button" onClick={() => step(1)} aria-label={kind === "month" ? "Próximo mês" : "Próximo ano"}
              className="grid size-11 shrink-0 place-items-center rounded-r-xl hover:bg-accent">
              <ChevronRight className="size-5" />
            </button>
          )}
        </div>

        {/* Visão */}
        <div role="radiogroup" aria-label="Visão" className="grid h-11 flex-1 grid-cols-2 items-center rounded-xl border bg-card p-1 sm:flex-none">
          {(["competencia", "caixa"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={basis === v}
              onClick={() => go({ visao: v === "competencia" ? null : v })}
              className={cn(
                "h-9 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors",
                basis === v && "bg-primary text-primary-foreground",
              )}
            >
              {v === "competencia" ? "Competência" : "Caixa"}
            </button>
          ))}
        </div>

        <Button type="button" variant={active.length ? "secondary" : "outline"} size="icon-lg"
          className="relative size-11 shrink-0 rounded-xl" aria-label="Filtros" onClick={() => setFiltersOpen(true)}>
          <SlidersHorizontal />
          {active.length > 0 && (
            <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {active.length}
            </span>
          )}
        </Button>
        {pending && <span className="sr-only" role="status">Carregando…</span>}
      </div>

      {active.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Filtros ativos">
          {active.map((k) => (
            <li key={k}>
              <button type="button" onClick={() => go({ [k]: null })}
                className="flex h-9 items-center gap-1.5 rounded-full border bg-surface-2/60 pr-2 pl-3 text-xs font-medium hover:bg-accent"
                aria-label={`Remover filtro ${names(k) ?? k}`}>
                {names(k) ?? "Filtro"} <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <PeriodSheet open={periodOpen} onOpenChange={setPeriodOpen} kind={kind} from={from} to={to} />

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent title="Filtros" description="Valem para todos os números e gráficos do painel.">
          <div className="grid gap-3">
            <label className="grid gap-1.5 text-sm font-medium">
              Categoria
              <select className={select} value={params.get("categoria") ?? ""} onChange={(e) => go({ categoria: e.target.value || null })}>
                <option value="">Todas</option>
                {categories.filter((c) => !c.parentId).map((c) => (
                  <optgroup key={c.id} label={c.kind === "income" ? `${c.name} (receita)` : c.name}>
                    <option value={c.id}>{c.name}{categories.some((s) => s.parentId === c.id) ? " (com subcategorias)" : ""}</option>
                    {categories.filter((s) => s.parentId === c.id).map((s) => (
                      <option key={s.id} value={s.id}>↳ {s.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            {members.length > 1 && (
              <label className="grid gap-1.5 text-sm font-medium">
                Membro
                <select className={select} value={params.get("membro") ?? ""} onChange={(e) => go({ membro: e.target.value || null })}>
                  <option value="">Todos</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </label>
            )}
            <label className="grid gap-1.5 text-sm font-medium">
              Conta
              <select className={select} value={params.get("conta") ?? ""} onChange={(e) => go({ conta: e.target.value || null })}>
                <option value="">Todas</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Cartão
              <select className={select} value={params.get("cartao") ?? ""} onChange={(e) => go({ cartao: e.target.value || null })}>
                <option value="">Todos</option>
                {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <div className="mt-2 flex gap-2">
              {active.length > 0 && (
                <Button type="button" variant="ghost" className="h-11 flex-1"
                  onClick={() => go(Object.fromEntries(FILTER_KEYS.map((k) => [k, null])))}>
                  Limpar filtros
                </Button>
              )}
              <Button type="button" className="h-11 flex-1" onClick={() => setFiltersOpen(false)}>Ver resultado</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function PeriodSheet({
  open,
  onOpenChange,
  kind,
  from,
  to,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  kind: "month" | "year" | "range";
  from: ISODate;
  to: ISODate;
}) {
  const { go } = useDashboardNav();
  const [tab, setTab] = useState(kind);
  const [month, setMonth] = useState(from.slice(0, 7));
  const [year, setYear] = useState(from.slice(0, 4));
  const [de, setDe] = useState<string>(from);
  const [ate, setAte] = useState<string>(to);
  const thisYear = new Date().getFullYear();
  const input = "h-11 w-full min-w-0 rounded-lg border border-input bg-surface-2/60 px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
  const invalidRange = !de || !ate || de > ate;

  function apply() {
    if (tab === "month") go({ periodo: month });
    else if (tab === "year") go({ ano: year });
    else if (!invalidRange) go({ de, ate });
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Período" description="Escolha um mês, um ano ou um intervalo de datas.">
        <div className="grid gap-4">
          <div role="tablist" aria-label="Tipo de período" className="grid grid-cols-3 rounded-xl border bg-surface-2/50 p-1">
            {([["month", "Mês"], ["year", "Ano"], ["range", "Intervalo"]] as const).map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={cn("h-10 rounded-lg text-sm font-medium text-muted-foreground", tab === k && "bg-card text-foreground shadow-sm")}>
                {l}
              </button>
            ))}
          </div>
          {tab === "month" && (
            <div className="grid gap-2">
              <label className="grid gap-1.5 text-sm font-medium">
                Mês
                <input type="month" className={input} value={month} onChange={(e) => setMonth(e.target.value)} />
              </label>
              <div className="flex flex-wrap gap-2">
                {[0, -1, -2].map((n) => {
                  const m = addMonths(monthStart(todayISO()), n);
                  return (
                    <button key={n} type="button" onClick={() => setMonth(m.slice(0, 7))}
                      className={cn("h-9 rounded-full border px-3 text-xs font-medium hover:bg-accent", month === m.slice(0, 7) && "border-primary text-primary")}>
                      {n === 0 ? "Este mês" : formatMonthTitle(m)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {tab === "year" && (
            <label className="grid gap-1.5 text-sm font-medium">
              Ano
              <select className={input} value={year} onChange={(e) => setYear(e.target.value)}>
                {Array.from({ length: 8 }, (_, i) => String(thisYear + 1 - i)).map((y) => <option key={y}>{y}</option>)}
              </select>
            </label>
          )}
          {tab === "range" && (
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5 text-sm font-medium">
                De
                <input type="date" className={input} value={de} max={ate} onChange={(e) => setDe(e.target.value)} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Até
                <input type="date" className={input} value={ate} min={de} onChange={(e) => setAte(e.target.value)} />
              </label>
              {invalidRange && <p className="col-span-2 text-xs text-destructive">A data final precisa ser igual ou depois da inicial.</p>}
              <p className="col-span-2 text-xs text-muted-foreground">Até 36 meses. A comparação usa o intervalo anterior de mesmo tamanho.</p>
            </div>
          )}
          <Button type="button" className="h-12" onClick={apply} disabled={tab === "range" && invalidRange}>Aplicar</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

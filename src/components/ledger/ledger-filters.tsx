"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LedgerLookups } from "@/lib/data/ledger";
import { cn } from "@/lib/utils";

/** Filtros na URL (?tipo=&categoria=...) → compartilháveis e sobrevivem ao recarregar. */
export function LedgerFilters({ lookups }: { lookups: LedgerLookups }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const active = ["tipo", "categoria", "membro", "conta", "cartao"].filter((k) => params.get(k));
  const [open, setOpen] = useState(active.length > 0);

  function set(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  // Busca com debounce de 300 ms.
  useEffect(() => {
    if ((params.get("q") ?? "") === q) return;
    const t = setTimeout(() => set("q", q.trim()), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const select = "h-11 w-full min-w-0 rounded-lg border border-input bg-surface-2/60 px-3 text-base md:text-sm";

  return (
    <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-3", pending && "opacity-70")}>
      <div className="flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Buscar lançamentos</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar descrição…"
            className="h-11 w-full rounded-lg border border-input bg-surface-2/60 pr-3 pl-9 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
          />
        </label>
        <Button
          type="button"
          variant={open ? "secondary" : "outline"}
          size="icon-lg"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="Filtros"
          className="relative size-11"
        >
          <SlidersHorizontal />
          {active.length > 0 && (
            <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {active.length}
            </span>
          )}
        </Button>
      </div>
      {open && (
        <div className="grid grid-cols-2 gap-2 rounded-2xl border bg-card p-3 animate-rise sm:grid-cols-3 lg:grid-cols-5">
          <select aria-label="Tipo" className={select} value={params.get("tipo") ?? ""} onChange={(e) => set("tipo", e.target.value)}>
            <option value="">Todos os tipos</option>
            <option value="expense">Despesas</option>
            <option value="income">Receitas</option>
            <option value="transfer">Transferências</option>
          </select>
          <select aria-label="Categoria" className={select} value={params.get("categoria") ?? ""} onChange={(e) => set("categoria", e.target.value)}>
            <option value="">Todas as categorias</option>
            {lookups.categories.filter((c) => !c.archived).map((c) => (
              <option key={c.id} value={c.id}>
                {c.kind === "income" ? "↑ " : ""}
                {c.name}
              </option>
            ))}
          </select>
          {lookups.members.length > 1 && (
            <select aria-label="Membro" className={select} value={params.get("membro") ?? ""} onChange={(e) => set("membro", e.target.value)}>
              <option value="">Todos os membros</option>
              {lookups.members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          )}
          <select aria-label="Conta" className={select} value={params.get("conta") ?? ""} onChange={(e) => set("conta", e.target.value)}>
            <option value="">Todas as contas</option>
            {lookups.accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <select aria-label="Cartão" className={select} value={params.get("cartao") ?? ""} onChange={(e) => set("cartao", e.target.value)}>
            <option value="">Todos os cartões</option>
            {lookups.cards.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {active.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              className="col-span-2 h-11 sm:col-span-1"
              onClick={() => {
                const next = new URLSearchParams();
                if (params.get("mes")) next.set("mes", params.get("mes")!);
                start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
              }}
            >
              <X /> Limpar filtros
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

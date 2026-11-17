"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownRight, ArrowLeftRight, ArrowUpRight, ChevronDown, CreditCard, Loader2, MessageCircle, PiggyBank, Trash2 } from "lucide-react";
import {
  deleteEntryAction,
  deleteInstallmentsAction,
  restoreEntryAction,
  saveEntryAction,
  updateInstallmentsAction,
} from "@/app/(app)/_actions/ledger";
import { FormMessage } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SheetContent } from "@/components/ui/sheet";
import { idleState } from "@/lib/action-state";
import type { LedgerLookups } from "@/lib/data/ledger";
import { formatMonth, type ISODate } from "@/lib/dates";
import { installmentInvoice, invoiceCycle } from "@/lib/domain/invoice";
import { formatBRL, splitInstallments } from "@/lib/money";
import { cn } from "@/lib/utils";
import { PAYMENT_LABELS } from "@/lib/validation/ledger";
import { CategoryIcon } from "./category-icon";
import { MoneyInput } from "./money-input";

import type { EntryDraft } from "./entry-sheet";
import { SelectField } from "./select-field";
import { ContributionForm } from "@/components/goals/contribution-form";
import { useEntrySheet } from "./entry-sheet";

/*
 * Conteúdo da folha de lançamento (formulário completo + editor de parcelas).
 * Fica num arquivo separado e é carregado sob demanda (next/dynamic) pelo
 * EntrySheetProvider: assim ~todo o JS do formulário sai do carregamento
 * inicial das páginas (desempenho no celular, Fase 3).
 */
export default function EntrySheetContent({
  draft,
  formKey,
  lookups,
  workspaceId,
  today,
  onDone,
}: {
  draft: EntryDraft;
  formKey: number;
  lookups: LedgerLookups;
  workspaceId: string;
  today: ISODate;
  onDone: () => void;
}) {
  const editing = Boolean(draft.id);
  const isInstallment = Boolean(draft.installmentTotal);
  if (draft.mode === "goal") {
    return (
      <SheetContent scroll={false} title={draft.goalKind === "withdrawal" ? "Retirar da meta" : "Guardar para meta"}>
        <ContributionForm
          key={formKey}
          workspaceId={workspaceId}
          lookups={lookups}
          today={today}
          goalId={draft.goalId}
          initialKind={draft.goalKind}
          onDone={onDone}
        />
      </SheetContent>
    );
  }
  return (
    <SheetContent
      scroll={isInstallment}
      title={editing ? (isInstallment ? `Parcela ${draft.installmentNumber}/${draft.installmentTotal}` : "Editar lançamento") : "Novo lançamento"}
    >
      {isInstallment ? (
        <InstallmentEditor key={formKey} draft={draft} lookups={lookups} onDone={onDone} />
      ) : (
        <EntryForm key={formKey} draft={draft} lookups={lookups} workspaceId={workspaceId} today={today} onDone={onDone} />
      )}
    </SheetContent>
  );
}

const KIND_OPTIONS = [
  { value: "expense", label: "Despesa", icon: ArrowDownRight },
  { value: "income", label: "Receita", icon: ArrowUpRight },
  { value: "transfer", label: "Transferência", icon: ArrowLeftRight },
] as const;

const QUICK_METHODS = {
  expense: ["pix", "debit", "credit", "cash"],
  income: ["pix", "transfer", "cash"],
} as const;

function EntryForm({
  draft,
  lookups,
  workspaceId,
  today,
  onDone,
}: {
  draft: EntryDraft;
  lookups: LedgerLookups;
  workspaceId: string;
  today: ISODate;
  onDone: () => void;
}) {
  const editing = Boolean(draft.id);
  const [state, action, pending] = useActionState(saveEntryAction, idleState);
  const { open: openSheet } = useEntrySheet();
  const router = useRouter();
  const [kind, setKind] = useState<"expense" | "income" | "transfer">(draft.kind ?? "expense");
  const [amount, setAmount] = useState(draft.amountCents ?? 0);
  const [categoryId, setCategoryId] = useState<string | null>(draft.categoryId ?? null);
  const defaultMethod = draft.paymentMethod ?? (lookups.defaults.paymentMethod === "credit" && lookups.cards.length === 0 ? "pix" : lookups.defaults.paymentMethod);
  const [method, setMethod] = useState<string>(defaultMethod);
  const [cardId, setCardId] = useState<string>(draft.cardId ?? lookups.defaults.cardId ?? lookups.cards[0]?.id ?? "");
  const [date, setDate] = useState<string>(draft.occurredOn ?? today);
  const [installments, setInstallments] = useState(1);
  const [showAllCats, setShowAllCats] = useState(false);
  const [more, setMore] = useState(editing);
  const [deleting, startDelete] = useTransition();

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      onDone();
    }
  }, [state, onDone]);

  const effectiveMethod = kind === "income" && method === "credit" ? "pix" : method;
  const isCredit = kind === "expense" && effectiveMethod === "credit";

  const categories = useMemo(() => {
    if (kind === "transfer") return [];
    const list = lookups.categories.filter((c) => c.kind === kind && !c.archived);
    const ranked = [...list].sort((a, b) => b.usage - a.usage);
    if (showAllCats) return list;
    const top = ranked.slice(0, 8);
    // A categoria já escolhida sempre aparece.
    if (categoryId && !top.some((c) => c.id === categoryId)) {
      const sel = list.find((c) => c.id === categoryId);
      if (sel) top[top.length - 1] = sel;
    }
    return top;
  }, [lookups.categories, kind, showAllCats, categoryId]);

  const card = lookups.cards.find((c) => c.id === cardId);
  const invoicePreview =
    isCredit && card && /^\d{4}-\d{2}-\d{2}$/.test(date) ? invoiceCycle(card.closingDay, card.dueDay, date as ISODate) : null;
  const parts = isCredit && installments > 1 && amount >= installments ? splitInstallments(amount, installments) : null;

  const errors = state.fieldErrors ?? {};
  const v = state.values ?? {};

  function remove() {
    if (!draft.id) return;
    startDelete(async () => {
      const res = await deleteEntryAction(draft.type ?? "transaction", draft.id!);
      if (res.status === "error") {
        toast.error(res.message);
        return;
      }
      onDone();
      toast.success(res.message, {
        duration: 8000,
        action: res.data?.undo
          ? {
              label: "Desfazer",
              onClick: async () => {
                const r = await restoreEntryAction(draft.id!);
                if (r.status === "error") toast.error(r.message);
                else toast.success(r.message);
              },
            }
          : undefined,
      });
    });
  }

  return (
    <form action={action} className="flex min-h-0 flex-1 flex-col" noValidate>
      {/* Área rolável */}
      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto overscroll-contain px-5 pb-4">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      {draft.id && <input type="hidden" name="id" value={draft.id} />}
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="paymentMethod" value={kind === "transfer" ? "transfer" : effectiveMethod} />
      <input type="hidden" name="categoryId" value={categoryId ?? ""} />

      {/* Tipo */}
      <div role="radiogroup" aria-label="Tipo de lançamento" className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-2/60 p-1">
        {KIND_OPTIONS.filter((o) => !editing || o.value === kind || (o.value !== "transfer" && kind !== "transfer")).map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={kind === o.value}
            disabled={editing && draft.type === "transfer"}
            onClick={() => {
              setKind(o.value);
              setCategoryId(null);
            }}
            className={cn(
              "flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-medium text-muted-foreground transition-colors",
              kind === o.value && "bg-card text-foreground shadow-sm",
              kind === o.value && o.value === "expense" && "text-expense",
              kind === o.value && o.value === "income" && "text-income",
            )}
          >
            <o.icon className="size-4" />
            <span className={cn(o.value === "transfer" && "max-[359px]:sr-only")}>{o.label}</span>
          </button>
        ))}
      </div>
      {!editing && lookups.goals.length > 0 && (
        <button
          type="button"
          onClick={() => openSheet({ mode: "goal" })}
          className="-mt-2 flex h-11 items-center justify-center gap-2 rounded-xl border border-dashed text-sm font-medium text-savings hover:bg-savings-muted"
        >
          <PiggyBank className="size-4" /> Guardar para meta
        </button>
      )}
      {!editing && (
        <Link
          href="/assistente"
          // Navega primeiro e só depois fecha a folha (fechar antes cancelava o clique no iPhone).
          onClick={(e) => {
            e.preventDefault();
            router.push("/assistente");
            setTimeout(onDone, 0);
          }}
          className="-mt-2 flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <MessageCircle className="size-4" /> Prefere escrever? Falar com o assistente
        </Link>
      )}

      <MoneyInput
        name="amountCents"
        label="Valor"
        defaultCents={draft.amountCents ?? (Number(v.amountCents) || 0)}
        autoFocus={!editing}
        invalid={Boolean(errors.amountCents)}
        onChangeCents={setAmount}
        tone={kind}
      />
      {errors.amountCents && <p className="-mt-2 text-center text-xs text-destructive">{errors.amountCents[0]}</p>}

      {kind === "transfer" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label="De (conta)" name="accountId" defaultValue={draft.accountId ?? lookups.accounts[0]?.id} errors={errors.accountId}>
            {lookups.accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </SelectField>
          <SelectField label="Para (conta)" name="toAccountId" defaultValue={draft.toAccountId ?? lookups.accounts[1]?.id} errors={errors.toAccountId}>
            {lookups.accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </SelectField>
          {lookups.accounts.length < 2 && (
            <p className="text-xs text-warning sm:col-span-2">Cadastre pelo menos duas contas em Contas para transferir.</p>
          )}
        </div>
      ) : (
        <>
          {/* Categoria: grade com as mais usadas primeiro */}
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">Categoria</legend>
            <div role="radiogroup" aria-label="Categoria" className="grid grid-cols-4 gap-2">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={categoryId === c.id}
                  onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}
                  className={cn(
                    "flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-2xl border border-transparent p-1.5 text-[11px] leading-tight transition-colors",
                    categoryId === c.id ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                  <span className="line-clamp-2 text-center">{c.name}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowAllCats((s) => !s)}
              className="justify-self-center text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              {showAllCats ? "Mostrar só as mais usadas" : "Ver todas as categorias"}
            </button>
          </fieldset>

          {/* Forma de pagamento */}
          <div role="radiogroup" aria-label="Forma de pagamento" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {QUICK_METHODS[kind].map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={effectiveMethod === m}
                disabled={editing && Boolean(draft.installmentTotal)}
                onClick={() => setMethod(m)}
                className={cn(
                  "flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors",
                  effectiveMethod === m ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground",
                )}
              >
                {m === "credit" && <CreditCard className="size-4" />}
                {PAYMENT_LABELS[m]}
              </button>
            ))}
          </div>

          {isCredit && (
            <div className="grid gap-3 rounded-2xl border bg-surface-2/40 p-3">
              {lookups.cards.length === 0 ? (
                <p className="text-sm text-warning">Cadastre um cartão em Cartões para lançar no crédito.</p>
              ) : (
                <>
                  <div className="grid grid-cols-[1fr_6.5rem] gap-3">
                    <SelectField label="Cartão" name="cardId" value={cardId} onChange={(e) => setCardId(e.target.value)} errors={errors.cardId}>
                      {lookups.cards.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </SelectField>
                    {!editing && (
                      <SelectField
                        label="Parcelas"
                        name="installments"
                        value={String(installments)}
                        onChange={(e) => setInstallments(Number(e.target.value))}
                        errors={errors.installments}
                      >
                        {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>{n === 1 ? "À vista" : `${n}x`}</option>
                        ))}
                      </SelectField>
                    )}
                  </div>
                  {invoicePreview && (
                    <p className="text-xs text-muted-foreground">
                      {parts ? (
                        <>
                          {installments}x de {formatBRL(parts[1])}
                          {parts[0] !== parts[1] && ` (1ª de ${formatBRL(parts[0])})`} — da fatura de{" "}
                          <strong className="text-foreground">{formatMonth(invoicePreview.referenceMonth)}</strong> até{" "}
                          {formatMonth(installmentInvoice(card!.closingDay, card!.dueDay, date as ISODate, installments))}.
                        </>
                      ) : (
                        <>
                          Cai na fatura de <strong className="text-foreground">{formatMonth(invoicePreview.referenceMonth)}</strong>,
                          vence em {formatDay(invoicePreview.dueDate)}.
                        </>
                      )}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Mais opções */}
      <button
        type="button"
        onClick={() => setMore((m) => !m)}
        aria-expanded={more}
        className="flex h-11 items-center justify-between rounded-xl px-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        Mais opções
        <ChevronDown className={cn("size-4 transition-transform", more && "rotate-180")} />
      </button>
      <div className={cn("grid gap-3", !more && "hidden")}>
        <div className="grid gap-2">
          <Label htmlFor="entry-desc">Descrição</Label>
          <Input
            id="entry-desc"
            name="description"
            maxLength={140}
            defaultValue={draft.description ?? v.description}
            placeholder={kind === "transfer" ? "Transferência" : "Usa o nome da categoria se ficar vazio"}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="entry-date">Data</Label>
            <Input id="entry-date" name="occurredOn" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          {kind !== "transfer" && !isCredit && (
            <SelectField label="Conta" name="accountId" defaultValue={draft.accountId ?? lookups.defaults.accountId ?? lookups.accounts[0]?.id ?? ""}>
              <option value="">Sem conta</option>
              {lookups.accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </SelectField>
          )}
        </div>
        {kind !== "transfer" && lookups.members.length > 1 && (
          <SelectField label={kind === "income" ? "Quem recebeu" : "Quem gastou"} name="memberUserId" defaultValue={draft.memberUserId ?? ""}>
            <option value="">Não informar</option>
            {lookups.members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </SelectField>
        )}
        {kind !== "transfer" && (
          <>
            <div className="grid gap-2">
              <Label htmlFor="entry-notes">Observação</Label>
              <textarea
                id="entry-notes"
                name="notes"
                maxLength={500}
                rows={2}
                defaultValue={draft.notes ?? v.notes ?? ""}
                className="min-h-11 rounded-lg border border-input bg-surface-2/60 px-3.5 py-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            {!isCredit && (
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  name="isSettled"
                  value="false"
                  defaultChecked={draft.isSettled === false}
                  className="size-5 accent-[var(--primary)]"
                />
                Ainda não foi pago/recebido (previsto)
              </label>
            )}
          </>
        )}
      </div>

      {state.status === "error" && <FormMessage state={state} />}
      </div>

      {/* Rodapé fixo (fora da rolagem): Salvar sempre visível e tocável */}
      <div className="flex shrink-0 gap-2 border-t bg-popover px-5 pt-3 pb-4">
        {editing && (
          <Button type="button" variant="destructive" size="lg" onClick={remove} disabled={deleting} aria-label="Excluir lançamento">
            {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
          </Button>
        )}
        <Button type="submit" size="lg" className="flex-1" disabled={pending || amount <= 0}>
          {pending && <Loader2 className="animate-spin" />}
          {editing ? "Salvar alterações" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

/** Edição de parcela: pergunta o escopo (só esta, esta e as futuras, todas). */
function InstallmentEditor({ draft, lookups, onDone }: { draft: EntryDraft; lookups: LedgerLookups; onDone: () => void }) {
  const [scope, setScope] = useState<"this" | "this_and_future" | "all">("this");
  const [description, setDescription] = useState(draft.description ?? "");
  const [categoryId, setCategoryId] = useState(draft.categoryId ?? "");
  const [notes, setNotes] = useState(draft.notes ?? "");
  const [pending, start] = useTransition();
  const categories = lookups.categories.filter((c) => c.kind === "expense" && !c.archived);

  const scopes = [
    { value: "this", label: "Só esta parcela" },
    { value: "this_and_future", label: "Esta e as próximas" },
    { value: "all", label: "Todas as parcelas" },
  ] as const;

  function save() {
    start(async () => {
      const res = await updateInstallmentsAction(draft.id!, scope, {
        description: description.trim() || "Compra parcelada",
        categoryId: categoryId || null,
        notes: notes.trim() || null,
        memberUserId: draft.memberUserId ?? null,
      });
      if (res.status === "error") return void toast.error(res.message);
      toast.success(res.message);
      onDone();
    });
  }
  function remove() {
    start(async () => {
      const res = await deleteInstallmentsAction(draft.id!, scope);
      if (res.status === "error") return void toast.error(res.message);
      toast.success(res.message);
      onDone();
    });
  }

  return (
    <div className="grid gap-4">
      <p className="rounded-xl bg-surface-2/60 p-3 text-sm text-muted-foreground">
        {formatBRL(draft.amountCents ?? 0)} nesta parcela. Para mudar valor ou número de parcelas, exclua a compra e
        lance de novo.
      </p>
      <div className="grid gap-2">
        <Label htmlFor="inst-desc">Descrição</Label>
        <Input id="inst-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={140} />
      </div>
      <SelectField label="Categoria" name="categoryId" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
        <option value="">Sem categoria</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </SelectField>
      <div className="grid gap-2">
        <Label htmlFor="inst-notes">Observação</Label>
        <Input id="inst-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Aplicar a</legend>
        {scopes.map((s) => (
          <label key={s.value} className="flex min-h-11 items-center gap-3 rounded-xl border px-3 text-sm has-checked:border-primary has-checked:bg-primary/10">
            <input type="radio" name="scope" value={s.value} checked={scope === s.value} onChange={() => setScope(s.value)} className="size-4 accent-[var(--primary)]" />
            {s.label}
          </label>
        ))}
      </fieldset>
      <div className="flex gap-2">
        <Button type="button" variant="destructive" size="lg" onClick={remove} disabled={pending}>
          <Trash2 /> Excluir
        </Button>
        <Button type="button" size="lg" className="flex-1" onClick={save} disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} Salvar
        </Button>
      </div>
    </div>
  );
}

const dayFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
function formatDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return dayFmt.format(new Date(Date.UTC(y, m - 1, d)));
}

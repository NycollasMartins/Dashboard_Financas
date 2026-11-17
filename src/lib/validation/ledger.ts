import { z } from "zod";

const uuid = z.uuid({ error: "Seleção inválida." });
const optionalUuid = z.preprocess((v) => (v === "" || v == null ? undefined : v), uuid.optional());
const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim() || undefined : v), z.string().max(max).optional());
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Data inválida." });
const cents = z.coerce
  .number({ error: "Informe o valor." })
  .int({ error: "Valor inválido." })
  .positive({ error: "O valor precisa ser maior que zero." })
  .max(99_999_999_99, { error: "Valor muito alto." });

export const PAYMENT_METHODS = ["pix", "debit", "credit", "cash", "transfer", "boleto", "other"] as const;
export const PAYMENT_LABELS: Record<(typeof PAYMENT_METHODS)[number], string> = {
  pix: "Pix",
  debit: "Débito",
  credit: "Crédito",
  cash: "Dinheiro",
  transfer: "Transferência",
  boleto: "Boleto",
  other: "Outro",
};

export const entrySchema = z
  .object({
    id: optionalUuid,
    workspaceId: uuid,
    kind: z.enum(["expense", "income", "transfer"]),
    amountCents: cents,
    description: optionalText(140),
    occurredOn: isoDate,
    categoryId: optionalUuid,
    paymentMethod: z.enum(PAYMENT_METHODS).default("pix"),
    accountId: optionalUuid,
    toAccountId: optionalUuid,
    cardId: optionalUuid,
    installments: z.coerce.number().int().min(1).max(48).default(1),
    memberUserId: optionalUuid,
    notes: optionalText(500),
    isSettled: z.preprocess((v) => v !== "false", z.boolean()),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "transfer") {
      if (!v.accountId) ctx.addIssue({ code: "custom", path: ["accountId"], message: "Escolha a conta de origem." });
      if (!v.toAccountId) ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Escolha a conta de destino." });
      if (v.accountId && v.accountId === v.toAccountId)
        ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Escolha contas diferentes." });
      return;
    }
    if (v.paymentMethod === "credit") {
      if (v.kind !== "expense")
        ctx.addIssue({ code: "custom", path: ["paymentMethod"], message: "Receitas não podem ser no crédito." });
      if (!v.cardId) ctx.addIssue({ code: "custom", path: ["cardId"], message: "Escolha o cartão." });
      if (v.installments > v.amountCents)
        ctx.addIssue({ code: "custom", path: ["installments"], message: "Parcelas demais para esse valor." });
    }
  });
export type EntryInput = z.infer<typeof entrySchema>;

export const scopeSchema = z.enum(["this", "this_and_future", "all"]);

export const cardSchema = z.object({
  id: optionalUuid,
  workspaceId: uuid,
  name: z.string().trim().min(1, { error: "Informe o nome." }).max(40),
  brand: optionalText(30),
  last4: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().regex(/^\d{4}$/, { error: "Use os 4 últimos dígitos." }).optional(),
  ),
  limitCents: z.preprocess((v) => (v === "" || v === "0" ? undefined : v), z.coerce.number().int().min(0).optional()),
  closingDay: z.coerce.number().int().min(1, { error: "Dia entre 1 e 31." }).max(31, { error: "Dia entre 1 e 31." }),
  dueDay: z.coerce.number().int().min(1, { error: "Dia entre 1 e 31." }).max(31, { error: "Dia entre 1 e 31." }),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#8b5cf6"),
});

export const accountSchema = z.object({
  id: optionalUuid,
  workspaceId: uuid,
  name: z.string().trim().min(1, { error: "Informe o nome." }).max(60),
  type: z.enum(["checking", "savings", "wallet", "investment", "other"]),
  institution: optionalText(60),
  initialBalanceCents: z.coerce.number().int().default(0),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#5eead4"),
});

export const ACCOUNT_TYPE_LABELS = {
  checking: "Conta corrente",
  savings: "Poupança",
  wallet: "Dinheiro / carteira",
  investment: "Investimento",
  other: "Outra",
} as const;

export const categorySchema = z.object({
  id: optionalUuid,
  workspaceId: uuid,
  kind: z.enum(["expense", "income"]),
  name: z.string().trim().min(1, { error: "Informe o nome." }).max(40),
  icon: z.string().regex(/^[a-z0-9-]{1,40}$/).default("circle"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#94a3b8"),
  parentId: optionalUuid,
});

export const recurrenceSchema = z
  .object({
    id: optionalUuid,
    workspaceId: uuid,
    kind: z.enum(["expense", "income"]),
    description: z.string().trim().min(1, { error: "Informe a descrição." }).max(140),
    amountCents: cents,
    categoryId: optionalUuid,
    paymentMethod: z.enum(PAYMENT_METHODS).default("pix"),
    accountId: optionalUuid,
    cardId: optionalUuid,
    memberUserId: optionalUuid,
    frequency: z.enum(["weekly", "monthly", "yearly"]).default("monthly"),
    dayOfMonth: z.coerce.number().int().min(1).max(31),
    startsOn: isoDate,
    endsOn: z.preprocess((v) => (v === "" ? undefined : v), isoDate.optional()),
    autoConfirm: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
    applyToFuture: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  })
  .superRefine((v, ctx) => {
    if (v.paymentMethod === "credit" && !v.cardId)
      ctx.addIssue({ code: "custom", path: ["cardId"], message: "Escolha o cartão." });
    if (v.paymentMethod === "credit" && v.kind === "income")
      ctx.addIssue({ code: "custom", path: ["paymentMethod"], message: "Receitas não podem ser no crédito." });
    if (v.endsOn && v.endsOn < v.startsOn)
      ctx.addIssue({ code: "custom", path: ["endsOn"], message: "O fim precisa ser depois do início." });
  });

export const invoicePaymentSchema = z.object({
  workspaceId: uuid,
  invoiceId: uuid,
  accountId: optionalUuid,
  amountCents: cents,
  paidOn: isoDate,
});

export const transactionFiltersSchema = z.object({
  mes: z.string().regex(/^\d{4}-\d{2}$/).optional().catch(undefined),
  tipo: z.enum(["expense", "income", "transfer"]).optional().catch(undefined),
  categoria: z.uuid().optional().catch(undefined),
  membro: z.uuid().optional().catch(undefined),
  conta: z.uuid().optional().catch(undefined),
  cartao: z.uuid().optional().catch(undefined),
  q: z.string().trim().max(80).optional().catch(undefined),
});
export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;

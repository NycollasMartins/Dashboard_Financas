/** Tipos de notificação (os mesmos do banco: notification_prefs.kind). Puro. */
export const NOTIFICATION_KINDS = [
  { kind: "bill_due", label: "Conta vencendo amanhã", hint: "Contas previstas fora do cartão" },
  { kind: "invoice_closing", label: "Fatura fechando", hint: "No dia anterior ao fechamento" },
  { kind: "invoice_due", label: "Fatura vencendo", hint: "No dia anterior ao vencimento, se houver saldo" },
  { kind: "weekly_summary", label: "Resumo semanal", hint: "Segunda-feira, a partir das 8h" },
  { kind: "goal_achieved", label: "Meta atingida", hint: "Na hora em que a meta é concluída" },
  { kind: "planned_contribution", label: "Aporte planejado do dia", hint: "Lembrete do aporte combinado" },
  { kind: "category_above_avg", label: "Gasto acima da média", hint: "Categoria passou da média dos 3 meses" },
  { kind: "member_entry", label: "Lançamento de outro membro", hint: "Opcional: quando alguém da família lança", defaultOff: true },
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]["kind"];
export const KIND_VALUES = NOTIFICATION_KINDS.map((k) => k.kind) as [NotificationKind, ...NotificationKind[]];

export type Pref = { kind: NotificationKind; enabled: boolean; push: boolean; telegram: boolean };

/** Preferência efetiva (sem linha no banco = padrão; igual a private.notify). */
export function effectivePref(kind: NotificationKind, row?: { enabled?: boolean; push?: boolean; telegram?: boolean } | null): Pref {
  const def = kind !== "member_entry";
  return { kind, enabled: row?.enabled ?? def, push: row?.push ?? def, telegram: row?.telegram ?? def };
}

/** "22:00" está dentro do silêncio 22:00–07:00? (janela pode virar a meia-noite) */
export function inQuietHours(now: string, start: string, end: string): boolean {
  return start > end ? now >= start || now < end : now >= start && now < end;
}

import { cn } from "@/lib/utils";

const LABELS = {
  open: { label: "Aberta", cls: "bg-primary/15 text-primary" },
  closed: { label: "Fechada", cls: "bg-warning/15 text-warning" },
  overdue: { label: "Vencida", cls: "bg-destructive/15 text-destructive" },
  paid: { label: "Paga", cls: "bg-income-muted text-income" },
} as const;

export function InvoiceStatusBadge({ status, className }: { status: keyof typeof LABELS; className?: string }) {
  const s = LABELS[status];
  return <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", s.cls, className)}>{s.label}</span>;
}

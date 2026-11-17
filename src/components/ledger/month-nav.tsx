import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, formatMonthTitle, type ISODate } from "@/lib/dates";

/** Navegação entre meses preservando os outros filtros da URL. */
export function MonthNav({ month, params, basePath }: { month: ISODate; params: Record<string, string | undefined>; basePath: string }) {
  const href = (m: ISODate) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
    q.set("mes", m.slice(0, 7));
    return `${basePath}?${q.toString()}`;
  };
  return (
    <div className="flex items-center gap-1">
      <Link href={href(addMonths(month, -1))} aria-label="Mês anterior" className="grid size-11 place-items-center rounded-xl hover:bg-accent">
        <ChevronLeft className="size-5" />
      </Link>
      <span className="min-w-36 text-center text-sm font-semibold">{formatMonthTitle(month)}</span>
      <Link href={href(addMonths(month, 1))} aria-label="Próximo mês" className="grid size-11 place-items-center rounded-xl hover:bg-accent">
        <ChevronRight className="size-5" />
      </Link>
    </div>
  );
}

import { formatBRL, type Cents } from "@/lib/money";
import { cn } from "@/lib/utils";

/** Exibe um valor em centavos formatado em BRL, com números tabulares. */
export function Money({
  cents,
  tone = "neutral",
  signed,
  className,
}: {
  cents: Cents;
  tone?: "neutral" | "income" | "expense" | "savings";
  signed?: boolean;
  className?: string;
}) {
  return (
    <span
      data-money
      className={cn(
        "text-money",
        tone === "income" && "text-income",
        tone === "expense" && "text-expense",
        tone === "savings" && "text-savings",
        className,
      )}
    >
      <span data-money-value>{formatBRL(cents, { signed })}</span>
    </span>
  );
}

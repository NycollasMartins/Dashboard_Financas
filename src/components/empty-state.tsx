import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid justify-items-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center animate-rise",
        className,
      )}
    >
      <span className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-muted-foreground">
        <Icon className="size-6" />
      </span>
      <h2 className="text-base font-semibold">{title}</h2>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {children}
    </div>
  );
}

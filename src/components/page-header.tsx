import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 flex flex-wrap items-end justify-between gap-4 animate-rise lg:mb-8", className)}>
      <div className="min-w-0 space-y-1">
        {eyebrow && (
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">{eyebrow}</p>
        )}
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {description && <p className="max-w-prose text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

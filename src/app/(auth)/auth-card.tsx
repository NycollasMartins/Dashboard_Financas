import { cn } from "@/lib/utils";

export function AuthCard({
  title,
  description,
  children,
  footer,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("glass rounded-2xl border p-6 shadow-2xl shadow-black/20 sm:p-8", className)}>
      <div className="mb-6 space-y-1.5">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
      {footer && <div className="mt-6 border-t pt-5 text-center text-sm text-muted-foreground">{footer}</div>}
    </div>
  );
}

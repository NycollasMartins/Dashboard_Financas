import { cn } from "@/lib/utils";

/** Marca: um "pulso" ascendente dentro de um anel — fluxo de dinheiro crescendo. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8", className)}>
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--primary)" />
          <stop offset="1" stopColor="var(--savings)" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#logo-g)" opacity="0.16" />
      <rect x="1.5" y="1.5" width="29" height="29" rx="8.5" fill="none" stroke="url(#logo-g)" strokeOpacity="0.5" />
      <path
        d="M7 20.5 12 15.5l3.5 3.5L24.5 10"
        fill="none"
        stroke="url(#logo-g)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24.5" cy="10" r="2.2" fill="var(--primary)" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="font-heading text-lg font-semibold tracking-tight">Finanças</span>
    </span>
  );
}

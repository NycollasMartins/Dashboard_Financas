import { cn } from "@/lib/utils";

/** Marca: um "pulso" ascendente dentro de um anel — fluxo de dinheiro crescendo. */
export function LogoMark({ className }: { className?: string }) {
  // Sem <defs>/ids: o mesmo SVG aparece várias vezes na página (sidebar oculta +
  // topo do celular) e ids repetidos quebram gradientes em elementos ocultos.
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8", className)}>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="var(--primary)" opacity="0.14" />
      <rect x="1.5" y="1.5" width="29" height="29" rx="8.5" fill="none" stroke="var(--primary)" strokeOpacity="0.45" />
      <path d="M7 20.5 12 15.5l3.5 3.5" fill="none" stroke="var(--savings)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.5 19 24.5 10" fill="none" stroke="var(--primary)" strokeWidth="2.6" strokeLinecap="round" />
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

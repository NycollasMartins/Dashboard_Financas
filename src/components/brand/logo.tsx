import { cn } from "@/lib/utils";

/**
 * Marca Lar+: contorno de uma casa (lar/família) e um "+" subindo (crescimento).
 * Mesmos caminhos de scripts/brand-mark.mjs (fonte dos ícones) — mudou lá, mude aqui.
 * Sem <defs>/ids: o SVG aparece várias vezes na página (sidebar oculta + topo do celular).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8", className)}>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="var(--primary)" opacity="0.12" />
      <g transform="translate(3 3) scale(0.8125)" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M6.5 15.5 15 8.6a1.6 1.6 0 0 1 2 0l2.2 1.8M9 13.6v9.9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6.8"
          stroke="var(--primary)"
          strokeWidth="2.6"
        />
        <path d="M14 25.5v-4.2a2 2 0 0 1 4 0v4.2" stroke="var(--primary)" strokeWidth="2.6" opacity="0.8" />
        <path d="M24.5 6.2v7M21 9.7h7" stroke="var(--savings)" strokeWidth="2.8" />
      </g>
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="font-heading text-lg font-semibold tracking-tight">
        Lar<span className="text-savings">+</span>
      </span>
    </span>
  );
}

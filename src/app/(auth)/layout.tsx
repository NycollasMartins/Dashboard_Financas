import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10">
      {/* Brilhos de fundo (decorativos) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-(--glow-1) blur-3xl animate-glow" />
        <div className="absolute -bottom-48 -left-24 size-[28rem] rounded-full bg-(--glow-2) blur-3xl animate-glow [animation-delay:-3s]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,var(--border)_1px,transparent_0)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      </div>

      <Logo className="mb-8 animate-rise" />
      <main className="w-full max-w-sm animate-rise [animation-delay:60ms]">{children}</main>
      <p className="mt-10 text-xs text-muted-foreground">Seus dados ficam isolados e protegidos.</p>
    </div>
  );
}

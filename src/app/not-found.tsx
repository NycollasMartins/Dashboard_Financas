import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="grid justify-items-center gap-4 text-center">
        <LogoMark className="size-12" />
        <h1 className="text-2xl font-semibold">Página não encontrada</h1>
        <p className="text-sm text-muted-foreground">O endereço pode estar errado ou a página mudou de lugar.</p>
        <Link href="/painel" className={buttonVariants()}>
          Ir para o painel
        </Link>
      </div>
    </main>
  );
}

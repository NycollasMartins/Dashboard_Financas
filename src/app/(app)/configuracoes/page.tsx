import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { KeyRound, LogOut, MessageCircle, Palette, User } from "lucide-react";
import { signOutAction } from "@/app/(auth)/actions";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getWorkspaceContext } from "@/lib/workspaces/context";
import { ProfileForm, ThemePicker } from "./profile-form";

export const metadata: Metadata = { title: "Configurações" };

function Block({ icon: Icon, title, children }: { icon: typeof User; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-5 animate-rise sm:p-6">
      <h2 className="mb-4 flex items-center gap-2 text-base font-semibold">
        <Icon className="size-[18px] text-muted-foreground" /> {title}
      </h2>
      {children}
    </section>
  );
}

async function Profile() {
  const { user } = await getWorkspaceContext();
  return <ProfileForm fullName={user.fullName} email={user.email} />;
}

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Configurações" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Block icon={User} title="Perfil">
          <Suspense fallback={<Skeleton className="h-52" />}>
            <Profile />
          </Suspense>
        </Block>
        <div className="grid content-start gap-4">
          <Block icon={Palette} title="Aparência">
            <ThemePicker />
          </Block>
          <Block icon={KeyRound} title="Segurança">
            <div className="flex flex-wrap gap-2">
              <Link href="/redefinir-senha" className={buttonVariants({ variant: "secondary" })}>
                Trocar senha
              </Link>
              <form action={signOutAction}>
                <Button type="submit" variant="destructive">
                  <LogOut /> Sair
                </Button>
              </form>
            </div>
          </Block>
          <Block icon={MessageCircle} title="WhatsApp e Telegram">
            <p className="text-sm text-muted-foreground">
              Na Fase 6 você vai gerar aqui um código para vincular seu número e lançar gastos por mensagem.
            </p>
          </Block>
        </div>
      </div>
    </>
  );
}

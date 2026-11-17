import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AtSign, KeyRound, LogOut, MessageCircle, Palette, ShieldAlert, User } from "lucide-react";
import { signOutAction } from "@/app/(auth)/actions";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspaces/context";
import { DeleteAccountSection, EmailChangeForm } from "./account-forms";
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

async function EmailChange() {
  const { user } = await getWorkspaceContext();
  return <EmailChangeForm currentEmail={user.email} />;
}

async function DeleteAccount() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_account_deletion_blockers");
  if (error) throw error;
  return <DeleteAccountSection blockers={data} />;
}

async function Profile() {
  const { user } = await getWorkspaceContext();
  return <ProfileForm fullName={user.fullName} />;
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
          <Block icon={AtSign} title="E-mail">
            <Suspense fallback={<Skeleton className="h-40" />}>
              <EmailChange />
            </Suspense>
          </Block>
          <Block icon={MessageCircle} title="WhatsApp e Telegram">
            <p className="text-sm text-muted-foreground">
              Na Fase 6 você vai gerar aqui um código para vincular seu número e lançar gastos por mensagem.
            </p>
          </Block>
        </div>
      </div>
      <section className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-5 sm:p-6">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <ShieldAlert className="size-[18px] text-destructive" /> Excluir conta
        </h2>
        <Suspense fallback={<Skeleton className="h-24" />}>
          <DeleteAccount />
        </Suspense>
      </section>
    </>
  );
}

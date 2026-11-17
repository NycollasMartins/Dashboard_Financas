import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Home, TriangleAlert } from "lucide-react";
import { signOutAction } from "@/app/(auth)/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { inviteTokenSchema } from "@/lib/validation/workspace";
import { AuthCard } from "../../auth-card";
import { AcceptInviteForm } from "./accept-form";

export const metadata: Metadata = { title: "Convite" };

export default function InvitePage({ params }: PageProps<"/convite/[token]">) {
  return (
    <Suspense fallback={<Skeleton className="h-72 w-full rounded-2xl" />}>
      <InviteContent params={params} />
    </Suspense>
  );
}

const STATUS_MESSAGES: Record<string, string> = {
  accepted: "Este convite já foi usado.",
  revoked: "Este convite foi cancelado por um administrador.",
  expired: "Este convite expirou. Peça um novo para quem te convidou.",
};

async function InviteContent({ params }: { params: PageProps<"/convite/[token]">["params"] }) {
  const { token } = await params;
  const user = await requireUser();
  const parsed = inviteTokenSchema.safeParse(token);

  const supabase = await createClient();
  const preview = parsed.success
    ? (await supabase.rpc("get_invite_preview", { p_token: parsed.data })).data?.[0]
    : undefined;

  if (!preview) {
    return <Problem title="Convite não encontrado" message="Confira se o link foi copiado inteiro." />;
  }
  if (preview.already_member) {
    return (
      <AuthCard title={`Você já participa de “${preview.workspace_name}”`}>
        <Link href="/painel" className={buttonVariants({ size: "lg", className: "w-full" })}>
          Ir para o painel
        </Link>
      </AuthCard>
    );
  }
  if (preview.status !== "pending") {
    return <Problem title="Convite indisponível" message={STATUS_MESSAGES[preview.status] ?? "Convite inválido."} />;
  }
  if (!preview.email_matches) {
    return (
      <AuthCard
        title="Este convite é para outro e-mail"
        description={
          <>
            Você entrou como <strong>{user.email}</strong>, mas o convite foi enviado para{" "}
            <strong>{preview.invited_email}</strong>. Saia e entre (ou crie a conta) com o e-mail convidado.
          </>
        }
      >
        <form action={signOutAction}>
          <Button type="submit" size="lg" variant="secondary" className="w-full">
            Sair e trocar de conta
          </Button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Você foi convidado"
      description={
        <>
          <strong>{preview.inviter_name}</strong> te convidou para participar da família{" "}
          <strong>“{preview.workspace_name}”</strong> como {preview.role === "admin" ? "administrador" : "membro"}.
        </>
      }
    >
      <div className="mb-5 flex items-center gap-3 rounded-xl border bg-surface-2/50 p-3 text-sm text-muted-foreground">
        <Home className="size-5 shrink-0 text-savings" />
        Vocês vão compartilhar lançamentos, cartões e metas desta família. Seu espaço individual continua só seu.
      </div>
      <AcceptInviteForm token={parsed.data!} />
    </AuthCard>
  );
}

function Problem({ title, message }: { title: string; message: string }) {
  return (
    <AuthCard title={title}>
      <div className="mb-5 flex items-center gap-3 text-sm text-muted-foreground">
        <TriangleAlert className="size-5 shrink-0 text-warning" />
        {message}
      </div>
      <Link href="/painel" className={buttonVariants({ variant: "secondary", size: "lg", className: "w-full" })}>
        Ir para o painel
      </Link>
    </AuthCard>
  );
}

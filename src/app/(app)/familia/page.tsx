import type { Metadata } from "next";
import { Suspense } from "react";
import { Crown, Home, MailPlus, Users } from "lucide-react";
import { WorkspaceIcon } from "@/components/app-shell/workspace-switcher";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { initials } from "@/lib/initials";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { getWorkspaceContext, type WorkspaceSummary } from "@/lib/workspaces/context";
import {
  CreateHouseholdForm,
  DeleteHouseholdButton,
  InviteForm,
  MemberActions,
  RenameWorkspaceForm,
  RevokeInviteButton,
} from "./forms";
import { SwitchToButton } from "./switch-to-button";

export const metadata: Metadata = { title: "Família" };

const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" });

function Section({
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon: typeof Users;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border bg-card p-5 animate-rise sm:p-6", className)}>
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-surface-2 text-muted-foreground">
          <Icon className="size-[18px]" />
        </span>
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function FamilyPage() {
  return (
    <>
      <PageHeader
        title="Família"
        description="Espaços familiares compartilham os mesmos dados entre os membros. Seu espaço individual continua só seu."
      />
      <Suspense fallback={<Skeleton className="h-80 rounded-2xl" />}>
        <FamilyContent />
      </Suspense>
    </>
  );
}

async function FamilyContent() {
  const { user, workspaces, active } = await getWorkspaceContext();
  const households = workspaces.filter((w) => w.kind === "household");

  return (
    <>
      <div className="grid gap-4">
        {active.kind === "household" ? (
          <ActiveHousehold workspace={active} userId={user.id} />
        ) : households.length > 0 ? (
          <Section title="Suas famílias" icon={Home} description="Abra uma família para ver membros e convites.">
            <ul className="grid gap-2">
              {households.map((h) => (
                <li key={h.id} className="flex items-center gap-3 rounded-xl border p-3">
                  <WorkspaceIcon kind="household" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{h.name}</span>
                    <span className="text-xs text-muted-foreground">{h.role === "admin" ? "Admin" : "Membro"}</span>
                  </span>
                  <SwitchToButton workspaceId={h.id} />
                </li>
              ))}
            </ul>
          </Section>
        ) : (
          <EmptyState
            icon={Users}
            title="Você ainda não tem uma família"
            description="Crie o espaço da família e convide quem divide as contas com você. Seu espaço individual continua separado."
          />
        )}

        <Section
          title="Criar nova família"
          icon={Home}
          description="Você será o administrador. Pode participar de mais de uma família."
        >
          <CreateHouseholdForm />
        </Section>
      </div>
    </>
  );
}

async function ActiveHousehold({ workspace, userId }: { workspace: WorkspaceSummary; userId: string }) {
  const supabase = await createClient();
  const isAdmin = workspace.role === "admin";
  const isOwner = workspace.ownerId === userId;

  const [membersRes, invitesRes] = await Promise.all([
    supabase.rpc("get_workspace_members", { p_workspace_id: workspace.id }),
    isAdmin
      ? supabase
          .from("workspace_invites")
          .select("id, email, role, expires_at, created_at")
          .eq("workspace_id", workspace.id)
          .is("accepted_at", null)
          .is("revoked_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (membersRes.error) throw membersRes.error;
  if (invitesRes.error) throw invitesRes.error;

  const members = membersRes.data;
  const invites = invitesRes.data ?? [];

  return (
    <>
      <Section title={workspace.name} icon={Users} description={`${members.length} ${members.length === 1 ? "membro" : "membros"}`}>
        <ul className="divide-y">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <Avatar className="size-10">
                <AvatarFallback className="bg-surface-2 text-sm font-semibold">
                  {initials(m.full_name, m.email)}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="truncate">{m.full_name || m.email}</span>
                  {m.user_id === userId && <span className="text-xs text-muted-foreground">(você)</span>}
                  {m.is_owner && <Crown className="size-3.5 shrink-0 text-warning" aria-label="Dono" />}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{m.email}</span>
              </span>
              <Badge variant={m.role === "admin" ? "default" : "secondary"} className="hidden sm:inline-flex">
                {m.role === "admin" ? "Admin" : "Membro"}
              </Badge>
              {!m.is_owner && (
                <MemberActions
                  workspaceId={workspace.id}
                  userId={m.user_id}
                  role={m.role}
                  isSelf={m.user_id === userId}
                  canManage={isAdmin}
                  canTransfer={isOwner}
                  memberName={m.full_name || m.email}
                />
              )}
            </li>
          ))}
        </ul>
      </Section>

      {isAdmin && (
        <Section
          title="Convidar pessoa"
          icon={MailPlus}
          description="Gere um link de convite e envie por WhatsApp ou e-mail. Só quem entrar com o e-mail convidado consegue usar."
        >
          <InviteForm workspaceId={workspace.id} />
          {invites.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">Convites pendentes</h3>
              <ul className="grid gap-2">
                {invites.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 rounded-xl border px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{i.email}</span>
                      <span className="text-xs text-muted-foreground">
                        {i.role === "admin" ? "Admin" : "Membro"} · expira em {dateFmt.format(new Date(i.expires_at))}
                      </span>
                    </span>
                    <RevokeInviteButton inviteId={i.id} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      {isAdmin && (
        <Section title="Configurações da família" icon={Home}>
          <RenameWorkspaceForm workspaceId={workspace.id} name={workspace.name} />
          {isOwner && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <div>
                <p className="text-sm font-medium">Zona de perigo</p>
                <p className="text-xs text-muted-foreground">Excluir apaga todos os dados da família.</p>
              </div>
              <DeleteHouseholdButton workspaceId={workspace.id} name={workspace.name} />
            </div>
          )}
        </Section>
      )}
    </>
  );
}

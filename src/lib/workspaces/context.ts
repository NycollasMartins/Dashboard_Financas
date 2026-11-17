import "server-only";
import { cache } from "react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type Kind = Database["public"]["Enums"]["workspace_kind"];
type Role = Database["public"]["Enums"]["member_role"];

export type WorkspaceSummary = {
  id: string;
  name: string;
  kind: Kind;
  ownerId: string;
  role: Role;
};

export type WorkspaceContext = {
  user: { id: string; email: string; fullName: string; avatarUrl: string | null; hideAmounts: boolean };
  workspaces: WorkspaceSummary[];
  active: WorkspaceSummary;
};

/**
 * Carrega o usuário, os espaços dele e o espaço ATIVO.
 * O espaço ativo fica salvo em profiles.last_workspace_id (vale em qualquer
 * dispositivo). A RLS garante que só aparecem espaços dos quais ele é membro.
 */
export const getWorkspaceContext = cache(async (): Promise<WorkspaceContext> => {
  const user = await requireUser();
  const supabase = await createClient();

  const [membershipsRes, profileRes] = await Promise.all([
    supabase
      .from("workspace_members")
      .select("role, workspace:workspaces!inner(id, name, kind, owner_id)")
      .eq("user_id", user.id),
    supabase.from("profiles").select("full_name, avatar_url, last_workspace_id, hide_amounts").eq("id", user.id).single(),
  ]);

  if (membershipsRes.error) throw membershipsRes.error;
  if (profileRes.error) throw profileRes.error;

  const workspaces: WorkspaceSummary[] = membershipsRes.data
    .map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      kind: m.workspace.kind,
      ownerId: m.workspace.owner_id,
      role: m.role,
    }))
    .sort((a, b) =>
      a.kind === b.kind ? a.name.localeCompare(b.name, "pt-BR") : a.kind === "personal" ? -1 : 1,
    );

  const personal = workspaces.find((w) => w.kind === "personal");
  if (!personal) throw new Error("Espaço pessoal não encontrado para o usuário.");

  const active = workspaces.find((w) => w.id === profileRes.data.last_workspace_id) ?? personal;

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: profileRes.data.full_name,
      avatarUrl: profileRes.data.avatar_url,
      hideAmounts: profileRes.data.hide_amounts,
    },
    workspaces,
    active,
  };
});

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { ISODate } from "@/lib/dates";
import type { Database } from "@/lib/supabase/database.types";

/*
 * Contrato comum das APIs internas (metas, lançamentos, assistente):
 * recebem o cliente com a SESSÃO do usuário (RLS decide) e devolvem Result,
 * nunca lançam exceção para erro de negócio.
 */
export type Ctx = { supabase: SupabaseClient<Database>; userId: string; today?: ISODate };
export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string[] | undefined> };

export const failure = (message: string, fieldErrors?: Record<string, string[] | undefined>) =>
  ({ ok: false, message, fieldErrors }) as const;
export const fieldErrorsOf = (e: z.ZodError) => z.flattenError(e).fieldErrors as Record<string, string[] | undefined>;

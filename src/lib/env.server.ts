import "server-only";
import { z } from "zod";

/**
 * Variáveis SECRETAS: só podem ser importadas em código de servidor.
 * O import "server-only" faz o build falhar se alguém importar isto num
 * Client Component.
 */
const serverSchema = z.object({
  // Usada a partir da Fase 6 (webhook do bot). Opcional por enquanto.
  SUPABASE_SECRET_KEY: z.string().min(20).optional(),
});

export const serverEnv = serverSchema.parse({
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
});

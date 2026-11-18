import "server-only";
import { z } from "zod";

/**
 * Variáveis SECRETAS: só podem ser importadas em código de servidor.
 * O import "server-only" faz o build falhar se alguém importar isto num
 * Client Component. Todas opcionais: sem elas, o recurso fica desligado
 * (o app continua funcionando).
 */
const serverSchema = z.object({
  // Webhook do Telegram e dispatcher de notificações (Fase 6). NUNCA no cliente.
  SUPABASE_SECRET_KEY: z.string().min(20).optional(),
  TELEGRAM_BOT_TOKEN: z.string().regex(/^\d+:[\w-]{30,}$/).optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().regex(/^[A-Za-z0-9_-]{24,256}$/).optional(),
  TELEGRAM_BOT_USERNAME: z.string().regex(/^\w{5,32}$/).default("LarMaisBot"),
  // Segredo do pg_cron → /api/notifications/dispatch.
  CRON_SECRET: z.string().min(24).optional(),
  // Web Push (VAPID). A pública também vai para o navegador (NEXT_PUBLIC_VAPID_PUBLIC_KEY).
  VAPID_PRIVATE_KEY: z.string().min(20).optional(),
  VAPID_SUBJECT: z.string().default("mailto:contato@larmais.tech"),
});

const empty = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);

export const serverEnv = serverSchema.parse({
  SUPABASE_SECRET_KEY: empty(process.env.SUPABASE_SECRET_KEY),
  TELEGRAM_BOT_TOKEN: empty(process.env.TELEGRAM_BOT_TOKEN),
  TELEGRAM_WEBHOOK_SECRET: empty(process.env.TELEGRAM_WEBHOOK_SECRET),
  TELEGRAM_BOT_USERNAME: empty(process.env.TELEGRAM_BOT_USERNAME),
  CRON_SECRET: empty(process.env.CRON_SECRET),
  VAPID_PRIVATE_KEY: empty(process.env.VAPID_PRIVATE_KEY),
  VAPID_SUBJECT: empty(process.env.VAPID_SUBJECT),
});

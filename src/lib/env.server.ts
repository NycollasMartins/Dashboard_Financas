import "server-only";
import { z } from "zod";

/**
 * Variáveis SECRETAS: só podem ser importadas em código de servidor.
 * O import "server-only" faz o build falhar se alguém importar isto num
 * Client Component. Todas opcionais: sem elas, o recurso fica desligado
 * (o app continua funcionando).
 *
 * Cada variável é validada SOZINHA: um valor com formato errado desliga só o
 * recurso dela (e aparece como "inválido" no /api/health?deep=1), em vez de
 * derrubar todas as telas que importam este arquivo.
 */
const serverSchema = {
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
} as const;

type Schema = typeof serverSchema;
export type ServerEnvName = keyof Schema;
export type ServerEnv = { [K in ServerEnvName]: z.output<Schema[K]> };
/** "ok" = presente e válido; "ausente"; "inválido" = presente mas com formato errado (ignorado). */
export type EnvStatus = "ok" | "ausente" | "inválido";

/**
 * Limpa o valor como veio do painel: espaços nas pontas e aspas em volta
 * (`"123:abc"` colado com aspas no EasyPanel vira `123:abc`). Vazio = ausente.
 */
export function cleanEnvValue(v: string | undefined): string | undefined {
  let s = (v ?? "").trim();
  if (s.length >= 2 && ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))) {
    s = s.slice(1, -1).trim();
  }
  return s || undefined;
}

export function parseServerEnv(source: Record<string, string | undefined>): { env: ServerEnv; status: Record<ServerEnvName, EnvStatus> } {
  const env = {} as Record<string, unknown>;
  const status = {} as Record<ServerEnvName, EnvStatus>;
  for (const name of Object.keys(serverSchema) as ServerEnvName[]) {
    const raw = cleanEnvValue(source[name]);
    const parsed = serverSchema[name].safeParse(raw);
    if (parsed.success) {
      env[name] = parsed.data;
      status[name] = raw === undefined ? "ausente" : "ok";
    } else {
      // Formato errado: o recurso fica desligado, mas o resto do app segue.
      env[name] = serverSchema[name].safeParse(undefined).data;
      status[name] = "inválido";
    }
  }
  return { env: env as ServerEnv, status };
}

const parsed = parseServerEnv({
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
  TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME,
  CRON_SECRET: process.env.CRON_SECRET,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
  VAPID_SUBJECT: process.env.VAPID_SUBJECT,
});

export const serverEnv: ServerEnv = parsed.env;
/** Só "ok/ausente/inválido" por variável — NUNCA o valor. */
export const serverEnvStatus = parsed.status;

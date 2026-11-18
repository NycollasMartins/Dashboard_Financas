import { after, connection } from "next/server";
import { handleTelegramWebhook } from "@/lib/telegram/webhook";

/** Webhook do @LarMaisBot — lógica em src/lib/telegram/webhook.ts (ADR-0021). */
export const maxDuration = 60;

export async function POST(request: Request) {
  await connection();
  return handleTelegramWebhook(request, (task) => after(task));
}

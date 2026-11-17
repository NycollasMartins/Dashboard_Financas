/** Leitura dos e-mails de teste capturados pelo Mailpit do Supabase local. */
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

type Message = { ID: string; Subject: string; To: { Address: string }[] };

export async function messagesTo(address: string): Promise<Message[]> {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`);
  const json = (await res.json()) as { messages: Message[] };
  return json.messages ?? [];
}

/** Espera chegar um e-mail para o endereço e devolve o primeiro link do corpo. */
export async function waitForLink(address: string, subject: RegExp, timeoutMs = 15_000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const msg = (await messagesTo(address)).find((m) => subject.test(m.Subject));
    if (msg) {
      const full = (await (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)).json()) as { HTML: string };
      const href = /href="([^"]+)"/.exec(full.HTML)?.[1];
      if (href) return href.replaceAll("&amp;", "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Nenhum e-mail "${subject}" para ${address}`);
}

"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, ExternalLink, Link2Off, QrCode, Send } from "lucide-react";
import { toast } from "sonner";
import { createTelegramLinkAction, setChannelSpaceAction, unlinkTelegramAction, type LinkCode } from "@/app/(app)/_actions/channels";
import { Button, buttonVariants } from "@/components/ui/button";

type Props = {
  botUsername: string;
  botConfigured: boolean;
  link: { label: string | null; workspaceId: string | null; since: string } | null;
  workspaces: { id: string; name: string }[];
};

function useCountdown(until: string | null) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!until) return;
    const tick = () => setLeft(Math.max(0, Math.round((new Date(until).getTime() - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [until]);
  return left;
}

export function TelegramPanel({ botUsername, botConfigured, link, workspaces }: Props) {
  const [code, setCode] = useState<LinkCode | null>(null);
  const [pending, start] = useTransition();
  const left = useCountdown(code?.expiresAt ?? null);
  const expired = code && left === 0;

  const generate = () => start(async () => {
    const r = await createTelegramLinkAction();
    if (r.status === "success" && r.data) setCode(r.data);
    else toast.error(r.message ?? "Erro");
  });

  return (
    <section className="rounded-2xl border bg-card p-5 sm:p-6" aria-labelledby="tg-title">
      <h2 id="tg-title" className="mb-1 flex items-center gap-2 text-base font-semibold">
        <Send className="size-[18px] text-primary" /> Telegram
        <span className="text-sm font-normal text-muted-foreground">@{botUsername}</span>
      </h2>
      {!botConfigured && (
        <p className="mb-3 rounded-xl bg-warning/10 p-3 text-sm text-warning">
          O bot ainda não está configurado neste servidor (TELEGRAM_BOT_TOKEN). Veja docs/setup-manual.md.
        </p>
      )}

      {link ? (
        <div className="grid gap-4">
          <p className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="size-4 text-income" />
            Vinculado{link.label ? ` a ${link.label}` : ""} desde {new Date(link.since).toLocaleDateString("pt-BR")}.
          </p>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Onde gravar o que chega pelo Telegram</span>
            <select
              className="h-11 rounded-xl border bg-surface-2 px-3 text-base"
              defaultValue={link.workspaceId ?? ""}
              onChange={(e) => start(async () => {
                const r = await setChannelSpaceAction(e.target.value);
                if (r.status === "success") toast.success(r.message);
                else toast.error(r.message);
              })}
            >
              {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <span className="text-xs text-muted-foreground">No chat, você também pode mandar “usar família” ou /espaco.</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <a href={`https://t.me/${botUsername}`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "secondary" })}>
              <ExternalLink /> Abrir o bot
            </a>
            <Button variant="destructive" disabled={pending} onClick={() => start(async () => {
              const r = await unlinkTelegramAction();
              if (r.status === "success") toast.success(r.message);
              else toast.error(r.message);
            })}>
              <Link2Off /> Desvincular
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Toque em <b className="text-foreground">Gerar código</b> (vale 10 minutos, uso único).</li>
            <li>No celular: toque em <b className="text-foreground">Abrir no Telegram</b> e depois em <b className="text-foreground">Iniciar</b>. No computador: leia o QR com a câmera do celular.</li>
            <li>Pronto: mande “gastei 50 no mercado”, uma foto de cupom ou um áudio.</li>
          </ol>
          {code && !expired ? (
            <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
              <div
                className="mx-auto size-44 overflow-hidden rounded-xl bg-white p-1 [&_svg]:size-full"
                role="img"
                aria-label="QR code para vincular o Telegram"
                dangerouslySetInnerHTML={{ __html: code.qrSvg }}
              />
              <div className="grid gap-2 text-center sm:text-left">
                <p className="text-sm text-muted-foreground">Seu código</p>
                <p className="font-mono text-3xl font-semibold tracking-[0.2em]" data-testid="link-code">{code.code}</p>
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  Expira em {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
                </p>
                <a href={code.deepLink} target="_blank" rel="noreferrer" className={buttonVariants()}>
                  <Send /> Abrir no Telegram
                </a>
              </div>
            </div>
          ) : (
            <Button onClick={generate} disabled={pending || !botConfigured} className="justify-self-start">
              <QrCode /> {expired ? "Gerar novo código" : "Gerar código"}
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Por segurança o bot só funciona em conversa privada (não em grupos) e um chat por pessoa. Fotos e áudios são lidos pela IA e descartados — veja o aviso de privacidade no Assistente.
          </p>
        </div>
      )}
    </section>
  );
}

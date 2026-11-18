"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { Camera, Check, ChevronDown, ImagePlus, Loader2, Mic, Pencil, SendHorizontal, ShieldCheck, Sparkles, Square, Trash2, Undo2, X } from "lucide-react";
import { clearAssistantHistoryAction, sendAssistantAction, type ChatMessage } from "@/app/(app)/_actions/assistant";
import { celebrateGoal } from "@/components/goals/celebration";
import { MoneyInput } from "@/components/ledger/money-input";
import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import type { ChatReply, PendingCard } from "@/lib/assistant/server/engine";
import { cn } from "@/lib/utils";
import { compressImage, MAX_AUDIO_SECONDS, pickAudioMime, startRecording, type Recording } from "./media";

const SUGGESTIONS = [
  "gastei 50 no uber",
  "100 mercado no débito",
  "ganhei 1000 de freela",
  "guardei 300 pra viagem",
  "quanto gastei com mercado?",
  "como está a meta do carro?",
  "fatura do nubank",
  "paguei o aluguel",
];

type Send = (input: Record<string, unknown>) => void;
const noopSubscribe = () => () => {};

/**
 * Chat do assistente (canal "app"). Toda a lógica está no motor de conversa
 * do servidor; aqui só desenhamos as respostas estruturadas.
 */
export function AssistantChat({ initial, aiConfigured }: { initial: ChatMessage[]; aiConfigured: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending]);

  const send: Send = (input) =>
    start(async () => {
      const body = input.kind === "image" ? "📷 Foto enviada" : input.kind === "audio" ? `🎤 Áudio (${input.seconds} s)` : String(input.label ?? input.text ?? "…");
      const optimistic: ChatMessage = { id: `tmp-${Date.now()}`, role: "user", body, createdAt: new Date().toISOString() };
      if (input.kind === "text" || input.kind === "image" || input.kind === "audio") setMessages((m) => [...m, optimistic]);
      const res = await sendAssistantAction(input);
      if (!res.ok) {
        toast.error(res.message);
        setMessages((m) => m.filter((x) => x.id !== optimistic.id));
        return;
      }
      setMessages((m) => [...m.filter((x) => x.id !== optimistic.id), ...res.messages]);
      const celebrate = res.messages.find((x) => x.reply?.done?.celebrate)?.reply?.done?.celebrate;
      if (celebrate) celebrateGoal(celebrate);
    });

  // ---- Foto (câmera/galeria) e áudio
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [photoMenu, setPhotoMenu] = useState(false);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [recSeconds, setRecSeconds] = useState(0);
  // Microfone disponível? (no servidor: não; no navegador: confere o MediaRecorder)
  const canRecord = useSyncExternalStore(
    noopSubscribe,
    () => Boolean(navigator.mediaDevices?.getUserMedia) && pickAudioMime() !== "",
    () => false,
  );
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setRecSeconds((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  const onPhoto = async (file: File | undefined) => {
    setPhotoMenu(false);
    if (!file) return;
    try {
      const img = await compressImage(file);
      send({ kind: "image", ...img });
    } catch {
      toast.error("Não consegui abrir essa imagem. Tente outra foto ou um print.");
    }
  };
  const recordingRef = useRef<Recording | null>(null);
  const stopRecording = async () => {
    const r = recordingRef.current;
    if (!r) return;
    recordingRef.current = null;
    setRecording(null);
    const audio = await r.stop();
    if (audio) send({ kind: "audio", ...audio });
    else toast.error("Áudio muito curto.");
  };
  const toggleMic = async () => {
    if (recording) return stopRecording();
    try {
      const r = await startRecording(() => void stopRecording());
      recordingRef.current = r;
      setRecSeconds(0);
      setRecording(r);
    } catch {
      toast.error("Não consegui usar o microfone. Libere o acesso nas permissões do navegador.");
    }
  };

  // Só a última leva de respostas é interativa (cartões antigos ficam "congelados").
  const lastUser = messages.map((m) => m.role).lastIndexOf("user");

  return (
    <div className="grid min-h-[calc(100dvh-14rem)] grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr_auto] gap-3 lg:min-h-[calc(100dvh-10rem)]">
      <PrivacyNote aiConfigured={aiConfigured} onClear={() => start(async () => { await clearAssistantHistoryAction(); setMessages([]); toast.success("Histórico apagado."); })} />

      <section aria-label="Conversa" aria-live="polite" className="grid content-end gap-3">
        {messages.length === 0 && (
          <div className="grid justify-items-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-primary/12 text-primary"><Sparkles className="size-6" /></span>
            <p className="max-w-sm text-sm text-muted-foreground">
              Escreva como você falaria com alguém: “gastei 50 no uber”, “guardei 300 pra viagem”, “quanto gastei com mercado?”.
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <Bubble key={m.id} message={m} interactive={i > lastUser && !pending} send={send} />
        ))}
        {pending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin" /> Pensando…
          </div>
        )}
        {/* Margem de rolagem: o fim da conversa para ACIMA da barra de digitação fixa. */}
        <div ref={endRef} className="h-px scroll-mb-44 lg:scroll-mb-36" />
      </section>

      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 grid gap-2 bg-background/95 pt-2 pb-1 backdrop-blur lg:bottom-0">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Exemplos">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" disabled={pending} onClick={() => send({ kind: "text", text: s })}
              className="h-9 shrink-0 rounded-full border bg-card px-3 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
              {s}
            </button>
          ))}
        </div>
        {photoMenu && (
          <div className="grid grid-cols-2 gap-2" role="menu" aria-label="Enviar foto">
            <Button type="button" variant="secondary" className="h-12" role="menuitem" onClick={() => cameraRef.current?.click()}><Camera /> Tirar foto</Button>
            <Button type="button" variant="secondary" className="h-12" role="menuitem" onClick={() => galleryRef.current?.click()}><ImagePlus /> Imagem ou print</Button>
          </div>
        )}
        {/* capture="environment": no iPhone abre a câmera traseira direto. */}
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden data-testid="photo-camera"
          onChange={(e) => { void onPhoto(e.target.files?.[0]); e.target.value = ""; }} />
        <input ref={galleryRef} type="file" accept="image/png,image/jpeg,image/webp,image/heic" hidden data-testid="photo-file"
          onChange={(e) => { void onPhoto(e.target.files?.[0]); e.target.value = ""; }} />
        {recording && (
          <div className="flex h-12 items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 text-sm" role="status">
            <span className="size-2.5 animate-pulse rounded-full bg-destructive" aria-hidden />
            Gravando… {recSeconds}s / {MAX_AUDIO_SECONDS}s
            <button type="button" className="ml-auto grid size-11 place-items-center rounded-xl text-muted-foreground hover:bg-accent" aria-label="Cancelar gravação"
              onClick={() => { recording.cancel(); recordingRef.current = null; setRecording(null); }}><X className="size-5" /></button>
          </div>
        )}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            // Lê o campo direto (funciona mesmo se o texto foi digitado antes da hidratação)
            // e não bloqueia enquanto a página se atualiza: o Next executa as ações em fila.
            const field = e.currentTarget.elements.namedItem("message") as HTMLInputElement;
            const t = field.value.trim();
            if (!t) return;
            setText("");
            field.value = "";
            send({ kind: "text", text: t });
          }}
        >
          <label className="sr-only" htmlFor="assistant-input">Mensagem para o assistente</label>
          <input
            id="assistant-input"
            name="message"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            autoComplete="off"
            enterKeyHint="send"
            placeholder="Ex.: gastei 45,90 no ifood ontem"
            className="h-12 min-w-0 flex-1 rounded-2xl border border-input bg-card px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <Button type="button" size="icon-lg" variant="secondary" className="size-12 rounded-2xl" aria-label="Enviar foto de comprovante"
            aria-expanded={photoMenu} disabled={Boolean(recording)} onClick={() => setPhotoMenu((v) => !v)}>
            <Camera />
          </Button>
          {canRecord && !text && (
            <Button type="button" size="icon-lg" variant={recording ? "destructive" : "secondary"} className="size-12 rounded-2xl"
              aria-label={recording ? "Parar e enviar áudio" : "Gravar áudio"} onClick={() => void toggleMic()}>
              {recording ? <Square /> : <Mic />}
            </Button>
          )}
          {(!canRecord || text) && (
            <Button type="submit" size="icon-lg" className="size-12 rounded-2xl" aria-label="Enviar">
              {pending ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}

function PrivacyNote({ aiConfigured, onClear }: { aiConfigured: boolean; onClear: () => void }) {
  return (
    <details className="group rounded-2xl border bg-card px-4 py-3 text-xs text-muted-foreground">
      <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
        <ShieldCheck className="size-4 shrink-0 text-primary" />
        <span className="flex-1">
          {aiConfigured
            ? "Entendo a maioria das mensagens aqui mesmo. Quando preciso de IA, envio só o texto e os nomes das suas categorias, contas, cartões e metas."
            : "IA não configurada: estou usando só o entendimento local (nada sai do app)."}
        </span>
        <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-2 grid gap-2 pl-6">
        <p>
          Nunca envio saldos, valores do seu histórico, e-mails ou nomes de pessoas. Respostas como “quanto gastei” são calculadas pelo
          banco do app, não pela IA. No plano gratuito do Google Gemini, o Google pode usar o texto enviado para melhorar os produtos
          (e pessoas podem revisá-lo) — evite escrever dados sensíveis.
        </p>
        <p>
          <b>Fotos e áudios:</b> a imagem vai para o Google Gemini e o áudio para o Groq (transcrição), só para ler o comprovante ou o que
          você falou. O arquivo <b>não é guardado</b> — fica só o lançamento, com “origem: foto/áudio”. Não extraímos nem gravamos CPF,
          CNPJ ou outros dados pessoais do comprovante. Evite fotografar documentos.
        </p>
        <button type="button" onClick={onClear} className="flex h-9 w-fit items-center gap-1.5 rounded-lg px-2 font-medium text-destructive hover:bg-destructive/10">
          <Trash2 className="size-3.5" /> Apagar histórico da conversa
        </button>
      </div>
    </details>
  );
}

function Bubble({ message, interactive, send }: { message: ChatMessage; interactive: boolean; send: Send }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end" data-role="user">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm whitespace-pre-wrap text-primary-foreground">{message.body}</p>
      </div>
    );
  }
  const r = message.reply;
  return (
    <div className="grid max-w-[92%] gap-2 justify-self-start" data-role="assistant">
      <p
        className={cn(
          "rounded-2xl rounded-bl-md border bg-card px-4 py-2.5 text-sm whitespace-pre-wrap",
          r?.tone === "success" && "border-income/30",
          r?.tone === "warning" && "border-warning/40",
          r?.tone === "error" && "border-destructive/40",
        )}
      >
        {message.body}
      </p>
      {r?.question?.options && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Opções">
          {r.question.options.map((o, i) => (
            <Button key={o.value} variant="outline" disabled={!interactive}
              onClick={() => send({ kind: "choose", pendingId: r.question!.pendingId, value: o.value, label: o.label })}>
              <span className="text-muted-foreground">{i + 1}.</span> {o.label}
            </Button>
          ))}
        </div>
      )}
      {r?.card && <ConfirmCard card={r.card} interactive={interactive} send={send} />}
      {r?.done && (
        <div className="grid gap-2 rounded-2xl border border-income/30 bg-income-muted/40 px-4 py-3 text-sm">
          <ul className="grid gap-1">
            {r.done.lines.map((l, i) => <li key={i} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-income" /><span data-money>{l}</span></li>)}
          </ul>
          {r.done.undoable && interactive && (
            <Button variant="outline" size="sm" className="h-10 w-fit" onClick={() => send({ kind: "undo", batchId: r.done!.batchId })}>
              <Undo2 /> Desfazer
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function ConfirmCard({ card, interactive, send }: { card: PendingCard; interactive: boolean; send: Send }) {
  const [editing, setEditing] = useState(false);
  const [edits, setEdits] = useState<Record<number, { amountCents?: number; categoryId?: string | null; date?: string }>>({});
  const set = (i: number, patch: (typeof edits)[number]) => setEdits((e) => ({ ...e, [i]: { ...e[i], ...patch } }));
  return (
    <div className="grid gap-3 rounded-2xl border bg-card p-3" role="group" aria-label="Confirmar lançamentos">
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Espaço: {card.workspaceName}</p>
      {card.media && <p className="rounded-xl bg-surface-2/60 px-3 py-2 text-xs whitespace-pre-wrap" data-testid="media-summary">{card.media.summary}</p>}
      <ul className="grid gap-2">
        {card.items.map((it) => (
          <li key={it.index} className="grid gap-2 rounded-xl bg-surface-2/50 px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{it.title}</span>
                <span className="block text-xs text-muted-foreground">{it.lines.join(" · ")}</span>
              </span>
              <Money cents={edits[it.index]?.amountCents ?? it.amountCents} tone={it.kind === "income" ? "income" : it.kind === "deposit" || it.kind === "withdrawal" ? "savings" : "neutral"} className="shrink-0 text-sm font-semibold" />
            </div>
            {editing && (
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="grid gap-1">
                  <span className="text-xs font-medium">Valor</span>
                  <MoneyInput name={`amount-${it.index}`} label={`Valor do item ${it.index + 1}`} size="md" defaultCents={it.amountCents} onChangeCents={(c) => set(it.index, { amountCents: c })} />
                </div>
                {it.categoryKind && (
                  <label className="grid gap-1 text-xs font-medium">
                    Categoria
                    <select defaultValue={it.categoryId ?? ""} onChange={(e) => set(it.index, { categoryId: e.target.value || null })}
                      className="h-12 w-full min-w-0 rounded-lg border border-input bg-surface-2/60 px-3 text-base md:text-sm">
                      <option value="">Sem categoria</option>
                      {card.categories.filter((c) => c.kind === it.categoryKind).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                )}
                <label className="grid gap-1 text-xs font-medium">
                  Data
                  <input type="date" defaultValue={it.date} onChange={(e) => set(it.index, { date: e.target.value })}
                    className="h-12 w-full min-w-0 rounded-lg border border-input bg-surface-2/60 px-3 text-base md:text-sm" />
                </label>
              </div>
            )}
          </li>
        ))}
      </ul>
      {editing && <p className="text-[11px] text-muted-foreground">Se você trocar a categoria, eu lembro para as próximas vezes.</p>}
      {interactive && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => send({ kind: "confirm", pendingId: card.pendingId, edits: Object.entries(edits).map(([i, e]) => ({ index: Number(i), ...e })) })}>
            <Check /> {card.items.length > 1 ? "Confirmar tudo" : "Confirmar"}
          </Button>
          {!editing && <Button variant="outline" onClick={() => setEditing(true)}><Pencil /> Editar</Button>}
          <Button variant="ghost" onClick={() => send({ kind: "cancel", pendingId: card.pendingId })}><X /> Cancelar</Button>
          {card.extras?.map((o) => (
            <Button key={o.value} variant="outline" className="h-auto min-h-11 whitespace-normal text-left"
              onClick={() => send({ kind: "choose", pendingId: card.pendingId, value: o.value, label: o.label })}>
              {o.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export type { ChatReply };

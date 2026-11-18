"use client";

import { useEffect, useState, useTransition } from "react";
import { BellOff, BellRing, PlusSquare, Share, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { removePushSubscriptionAction, savePushSubscriptionAction, sendTestPushAction } from "@/app/(app)/_actions/notifications";
import { Button } from "@/components/ui/button";

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

function urlB64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/**
 * Ativar notificações NESTE aparelho. No iPhone (iOS 16.4+) o push só existe
 * com o app adicionado à Tela de Início e aberto por ela → mostramos o guia
 * antes. A permissão só é pedida no toque em "Ativar notificações".
 */
export function PushSetup({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [state, setState] = useState<State>("loading");
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      // iPhone/iPad: push SÓ com o app na Tela de Início e aberto por ela (iOS 16.4+).
      if (isIOS() && !isStandalone()) return setState("ios-install");
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) return setState("unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  const enable = () => start(async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(vapidPublicKey),
      }));
      const json = sub.toJSON();
      const r = await savePushSubscriptionAction({
        endpoint: json.endpoint, keys: json.keys,
        deviceLabel: isIOS() ? "iPhone/iPad" : /Android/.test(navigator.userAgent) ? "Android" : "Computador",
      });
      if (r.status === "success") {
        setState("on");
        toast.success(r.message);
      } else toast.error(r.message);
    } catch {
      toast.error("Não foi possível ativar neste aparelho.");
    }
  });

  const disable = () => start(async () => {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await removePushSubscriptionAction(sub.endpoint);
      await sub.unsubscribe();
    }
    setState("off");
  });

  if (!vapidPublicKey) {
    return <p className="text-sm text-muted-foreground">Push ainda não configurado no servidor (chaves VAPID). A central e o Telegram funcionam.</p>;
  }
  if (state === "loading") return <div className="h-11 w-48 animate-pulse rounded-xl bg-muted" />;
  if (state === "ios-install") {
    return (
      <div className="grid gap-3" data-testid="ios-install-guide">
        <p className="text-sm">No iPhone, as notificações funcionam com o <b>Lar+ na Tela de Início</b> (iOS 16.4 ou mais novo):</p>
        <ol className="grid gap-2 text-sm">
          <li className="flex items-center gap-3 rounded-xl bg-surface-2 p-3"><Share className="size-5 shrink-0 text-primary" /> 1. No Safari, toque em <b>Compartilhar</b>.</li>
          <li className="flex items-center gap-3 rounded-xl bg-surface-2 p-3"><PlusSquare className="size-5 shrink-0 text-primary" /> 2. Escolha <b>Adicionar à Tela de Início</b> → <b>Adicionar</b>.</li>
          <li className="flex items-center gap-3 rounded-xl bg-surface-2 p-3"><Smartphone className="size-5 shrink-0 text-primary" /> 3. Abra o Lar+ <b>pelo ícone</b> e volte aqui para ativar.</li>
        </ol>
      </div>
    );
  }
  if (state === "unsupported") return <p className="text-sm text-muted-foreground">Este navegador não suporta notificações push. Use a central do app ou o Telegram.</p>;
  if (state === "denied") {
    return (
      <p className="text-sm text-muted-foreground">
        As notificações foram bloqueadas. Para liberar: iPhone → <b>Ajustes → Notificações → Lar+</b>; Android/computador → cadeado na barra de endereço → Notificações → Permitir.
      </p>
    );
  }
  return state === "on" ? (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" disabled={pending} onClick={() => start(async () => {
        const r = await sendTestPushAction();
        if (r.status === "success") toast.success(r.message);
        else toast.error(r.message);
      })}>
        <BellRing /> Enviar teste
      </Button>
      <Button variant="ghost" disabled={pending} onClick={disable}><BellOff /> Desativar neste aparelho</Button>
    </div>
  ) : (
    <Button onClick={enable} disabled={pending}><BellRing /> Ativar notificações</Button>
  );
}

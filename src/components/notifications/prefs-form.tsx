"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setNotificationPrefAction, setQuietHoursAction } from "@/app/(app)/_actions/notifications";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { NOTIFICATION_KINDS, type Pref } from "@/lib/notifications/kinds";

/** Cada tipo: ligado/desligado e canais (push, Telegram). A central do app recebe todos os ligados. */
export function PrefsForm({ initial, telegramLinked }: { initial: Pref[]; telegramLinked: boolean }) {
  const [prefs, setPrefs] = useState(initial);
  const [, start] = useTransition();

  const update = (kind: Pref["kind"], patch: Partial<Pref>) => {
    const next = prefs.map((p) => (p.kind === kind ? { ...p, ...patch } : p));
    setPrefs(next);
    start(async () => {
      const r = await setNotificationPrefAction(next.find((p) => p.kind === kind));
      if (r.status === "error") toast.error(r.message);
    });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="py-2 font-medium">Avisar sobre</th>
            <th className="w-14 text-center font-medium">Ligado</th>
            <th className="w-14 text-center font-medium">Push</th>
            <th className="w-14 text-center font-medium">Telegram</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {NOTIFICATION_KINDS.map(({ kind, label, hint }) => {
            const p = prefs.find((x) => x.kind === kind)!;
            return (
              <tr key={kind}>
                <td className="py-2 pr-2">
                  <p className="font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{hint}</p>
                </td>
                <td><Switch label={`${label}: ligado`} checked={p.enabled} onCheckedChange={(v) => update(kind, { enabled: v })} className="mx-auto" /></td>
                <td><Switch label={`${label}: push`} checked={p.enabled && p.push} disabled={!p.enabled} onCheckedChange={(v) => update(kind, { push: v })} className="mx-auto" /></td>
                <td><Switch label={`${label}: Telegram`} checked={p.enabled && p.telegram && telegramLinked} disabled={!p.enabled || !telegramLinked} onCheckedChange={(v) => update(kind, { telegram: v })} className="mx-auto" /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!telegramLinked && <p className="mt-2 text-xs text-muted-foreground">Vincule o Telegram em Configurações → Canais para receber por lá.</p>}
    </div>
  );
}

export function QuietHoursForm({ initial }: { initial: { enabled: boolean; start: string; end: string } }) {
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await setQuietHoursAction(v);
          if (r.status === "success") toast.success(r.message);
          else toast.error(r.message);
        });
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm">Não enviar push/Telegram neste horário (a central continua recebendo)</span>
        <Switch label="Horário de silêncio" checked={v.enabled} onCheckedChange={(enabled) => setV({ ...v, enabled })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-sm">
          De
          <input type="time" value={v.start} onChange={(e) => setV({ ...v, start: e.target.value })} disabled={!v.enabled}
            className="h-11 rounded-xl border bg-surface-2 px-3 text-base" />
        </label>
        <label className="grid gap-1 text-sm">
          Até
          <input type="time" value={v.end} onChange={(e) => setV({ ...v, end: e.target.value })} disabled={!v.enabled}
            className="h-11 rounded-xl border bg-surface-2 px-3 text-base" />
        </label>
      </div>
      <Button type="submit" variant="secondary" disabled={pending} className="justify-self-start">Salvar horário</Button>
    </form>
  );
}

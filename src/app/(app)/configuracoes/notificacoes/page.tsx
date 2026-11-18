import type { Metadata } from "next";
import { Suspense } from "react";
import { BellRing, Moon, SlidersHorizontal } from "lucide-react";
import { PrefsForm, QuietHoursForm } from "@/components/notifications/prefs-form";
import { PushSetup } from "@/components/notifications/push-setup";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { effectivePref, NOTIFICATION_KINDS } from "@/lib/notifications/kinds";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Notificações" };

function Block({ icon: Icon, title, children }: { icon: typeof BellRing; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-2 text-base font-semibold"><Icon className="size-[18px] text-muted-foreground" /> {title}</h2>
      {children}
    </section>
  );
}

async function Content() {
  const supabase = await createClient();
  const [prefs, settings, link] = await Promise.all([
    supabase.from("notification_prefs").select("kind, enabled, push, telegram"),
    supabase.from("notification_settings").select("quiet_enabled, quiet_start, quiet_end").maybeSingle(),
    supabase.from("channel_links").select("id").eq("channel", "telegram").maybeSingle(),
  ]);
  const rows = prefs.data ?? [];
  const initial = NOTIFICATION_KINDS.map(({ kind }) => effectivePref(kind, rows.find((r) => r.kind === kind)));
  const q = settings.data;
  return (
    <>
      <Block icon={SlidersHorizontal} title="O que avisar e por onde">
        <PrefsForm initial={initial} telegramLinked={Boolean(link.data)} />
      </Block>
      <Block icon={Moon} title="Horário de silêncio">
        <QuietHoursForm initial={{ enabled: q?.quiet_enabled ?? true, start: (q?.quiet_start ?? "22:00").slice(0, 5), end: (q?.quiet_end ?? "07:00").slice(0, 5) }} />
      </Block>
    </>
  );
}

export default function NotificationSettingsPage() {
  return (
    <>
      <PageHeader eyebrow="Configurações" title="Notificações" description="Escolha o que avisar e por onde: notificação no aparelho (push), Telegram e a central do app." />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:max-w-3xl">
        <Block icon={BellRing} title="Neste aparelho">
          <PushSetup vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />
        </Block>
        <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
          <Content />
        </Suspense>
      </div>
    </>
  );
}

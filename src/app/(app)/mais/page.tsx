import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { MORE_ITEMS } from "@/components/app-shell/nav-config";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Mais" };

export default function MorePage() {
  return (
    <>
      <PageHeader title="Mais" />
      <nav aria-label="Mais opções" className="overflow-hidden rounded-2xl border bg-card">
        <ul className="divide-y">
          {MORE_ITEMS.map(({ href, label, icon: Icon, comingInPhase }) => (
            <li key={href}>
              <Link href={href} className="flex min-h-14 items-center gap-3 px-4 hover:bg-accent">
                <span className="grid size-9 place-items-center rounded-xl bg-surface-2 text-muted-foreground">
                  <Icon className="size-[18px]" />
                </span>
                <span className="flex-1 font-medium">{label}</span>
                {comingInPhase && (
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    em breve
                  </span>
                )}
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

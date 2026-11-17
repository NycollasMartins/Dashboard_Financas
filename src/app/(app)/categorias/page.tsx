import type { Metadata } from "next";
import { Suspense } from "react";
import { CategoryFormButton } from "@/components/ledger/category-form";
import { CategoryIcon } from "@/components/ledger/category-icon";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getLedgerLookups, type CategoryOption } from "@/lib/data/ledger";
import { getWorkspaceContext } from "@/lib/workspaces/context";

export const metadata: Metadata = { title: "Categorias" };

export default function CategoriesPage() {
  return (
    <>
      <PageHeader title="Categorias" description="As mais usadas aparecem primeiro no lançamento rápido." />
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <CategoriesContent />
      </Suspense>
    </>
  );
}

async function CategoriesContent() {
  const { user, active } = await getWorkspaceContext();
  const { categories } = await getLedgerLookups(active.id, user.id);

  const group = (kind: "expense" | "income") => {
    const list = categories.filter((c) => c.kind === kind && !c.archived);
    return list.filter((c) => !c.parentId).map((p) => ({ parent: p, children: list.filter((c) => c.parentId === p.id) }));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {(["expense", "income"] as const).map((kind) => (
        <section key={kind} className="animate-rise">
          <header className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-base font-semibold">{kind === "expense" ? "Despesas" : "Receitas"}</h2>
            <CategoryFormButton workspaceId={active.id} categories={categories} kind={kind} />
          </header>
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
            {group(kind).map(({ parent, children }) => (
              <li key={parent.id}>
                <Row c={parent} workspaceId={active.id} all={categories} />
                {children.length > 0 && (
                  <ul className="border-t bg-surface-2/30 pl-8">
                    {children.map((ch) => (
                      <li key={ch.id}>
                        <Row c={ch} workspaceId={active.id} all={categories} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Row({ c, workspaceId, all }: { c: CategoryOption; workspaceId: string; all: CategoryOption[] }) {
  return (
    <div className="flex min-h-14 items-center gap-3 px-3 py-2">
      <CategoryIcon icon={c.icon} color={c.color} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{c.name}</span>
        {c.usage > 0 && <span className="text-xs text-muted-foreground">{c.usage} lançamentos nos últimos 3 meses</span>}
      </span>
      <CategoryFormButton workspaceId={workspaceId} categories={all} category={c} />
    </div>
  );
}

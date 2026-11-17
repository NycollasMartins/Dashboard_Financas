"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { deleteCategoryAction, saveCategoryAction } from "@/app/(app)/_actions/ledger";
import { Field, FormMessage, SubmitButton } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { idleState } from "@/lib/action-state";
import type { CategoryOption } from "@/lib/data/ledger";
import { cn } from "@/lib/utils";
import { ColorPicker } from "./card-form";
import { CATEGORY_ICONS, CategoryIcon } from "./category-icon";
import { SelectField } from "./entry-sheet";

export function CategoryFormButton({
  workspaceId,
  categories,
  category,
  kind = "expense",
}: {
  workspaceId: string;
  categories: CategoryOption[];
  category?: CategoryOption;
  kind?: "expense" | "income";
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {category ? (
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label={`Editar ${category.name}`}>
          <Pencil />
        </Button>
      ) : (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          <Plus /> Nova
        </Button>
      )}
      {open && (
        <SheetContent title={category ? "Editar categoria" : kind === "income" ? "Nova categoria de receita" : "Nova categoria de despesa"}>
          <CategoryForm workspaceId={workspaceId} categories={categories} category={category} kind={category?.kind ?? kind} onDone={() => setOpen(false)} />
        </SheetContent>
      )}
    </Sheet>
  );
}

function CategoryForm({
  workspaceId,
  categories,
  category,
  kind,
  onDone,
}: {
  workspaceId: string;
  categories: CategoryOption[];
  category?: CategoryOption;
  kind: "expense" | "income";
  onDone: () => void;
}) {
  const [state, action] = useActionState(saveCategoryAction, idleState);
  const [icon, setIcon] = useState(category?.icon ?? "circle");
  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      onDone();
    }
  }, [state, onDone]);
  const parents = categories.filter((c) => c.kind === kind && !c.parentId && c.id !== category?.id);
  const hasChildren = categories.some((c) => c.parentId === category?.id);

  return (
    <div className="grid gap-6">
      <form action={action} className="grid gap-4" noValidate>
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="icon" value={icon} />
        {category && <input type="hidden" name="id" value={category.id} />}
        <Field label="Nome" name="name" defaultValue={category?.name ?? state.values?.name} maxLength={40} errors={state.fieldErrors?.name} />
        {!hasChildren && (
          <SelectField label="Subcategoria de" name="parentId" defaultValue={category?.parentId ?? ""}>
            <option value="">Nenhuma (categoria principal)</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </SelectField>
        )}
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Ícone</legend>
          <div role="radiogroup" aria-label="Ícone" className="grid grid-cols-6 gap-2 sm:grid-cols-8">
            {Object.keys(CATEGORY_ICONS).map((name) => (
              <button
                key={name}
                type="button"
                role="radio"
                aria-checked={icon === name}
                aria-label={name}
                onClick={() => setIcon(name)}
                className={cn("grid size-11 place-items-center rounded-xl border border-transparent", icon === name && "border-primary bg-primary/10")}
              >
                <CategoryIcon icon={name} color="#94a3b8" size="sm" className="bg-transparent" />
              </button>
            ))}
          </div>
        </fieldset>
        <ColorPicker name="color" defaultValue={category?.color ?? "#94a3b8"} />
        {state.status === "error" && <FormMessage state={state} />}
        <SubmitButton size="lg" pendingText="Salvando…">Salvar</SubmitButton>
      </form>
      {category && <DeleteCategory category={category} categories={categories} onDone={onDone} />}
    </div>
  );
}

function DeleteCategory({ category, categories, onDone }: { category: CategoryOption; categories: CategoryOption[]; onDone: () => void }) {
  const [pending, start] = useTransition();
  const targets = categories.filter((c) => c.kind === category.kind && c.id !== category.id && c.parentId !== category.id);
  const [target, setTarget] = useState(targets.find((t) => t.name === "Outros" || t.name === "Outras receitas")?.id ?? targets[0]?.id ?? "");
  return (
    <section className="grid gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
      <h3 className="text-sm font-semibold">Excluir categoria</h3>
      <p className="text-xs text-muted-foreground">
        Se houver lançamentos, recorrências ou subcategorias usando “{category.name}”, eles passam para a categoria escolhida abaixo.
      </p>
      <SelectField label="Mover lançamentos para" name="reassign" value={target} onChange={(e) => setTarget(e.target.value)}>
        {targets.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </SelectField>
      <Button
        variant="destructive"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await deleteCategoryAction(category.id, target || null);
            if (r.status === "error") toast.error(r.message);
            else {
              toast.success(r.message);
              onDone();
            }
          })
        }
      >
        <Trash2 /> Excluir e mover lançamentos
      </Button>
    </section>
  );
}

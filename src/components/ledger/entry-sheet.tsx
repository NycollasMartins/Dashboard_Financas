"use client";

import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import type { LedgerLookups } from "@/lib/data/ledger";
import type { ISODate } from "@/lib/dates";

export { SelectField } from "./select-field";

/** Formulário carregado sob demanda (ver entry-form.tsx). */
const EntrySheetContent = dynamic(() => import("./entry-form"), { ssr: false });

export type EntryDraft = {
  id?: string;
  type?: "transaction" | "transfer";
  kind?: "expense" | "income" | "transfer";
  amountCents?: number;
  description?: string;
  occurredOn?: string;
  categoryId?: string | null;
  paymentMethod?: string | null;
  accountId?: string | null;
  toAccountId?: string | null;
  cardId?: string | null;
  memberUserId?: string | null;
  notes?: string | null;
  isSettled?: boolean;
  installmentNumber?: number | null;
  installmentTotal?: number | null;
};

type Ctx = { open: (draft?: EntryDraft) => void };
const EntrySheetContext = createContext<Ctx>({ open: () => {} });
export const useEntrySheet = () => useContext(EntrySheetContext);

export function EntrySheetProvider({
  workspaceId,
  lookups,
  today,
  children,
}: {
  workspaceId: string;
  lookups: LedgerLookups;
  today: ISODate;
  children: React.ReactNode;
}) {
  const [draft, setDraft] = useState<EntryDraft | null>(null);
  const [key, setKey] = useState(0);
  const open = useCallback((d?: EntryDraft) => {
    setDraft(d ?? {});
    setKey((k) => k + 1);
  }, []);

  // Atalho no desktop: tecla "N" abre um novo lançamento.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      e.preventDefault();
      open();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Pré-carrega o formulário quando o navegador estiver ocioso: o 1º toque no
  // "+" continua instantâneo, mas o JS não pesa no carregamento da página.
  useEffect(() => {
    const load = () => void import("./entry-form");
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(load, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(load, 2500);
    return () => clearTimeout(t);
  }, []);

  return (
    <EntrySheetContext.Provider value={{ open }}>
      {children}
      <Sheet open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        {draft && (
          <EntrySheetContent
            draft={draft}
            formKey={key}
            lookups={lookups}
            workspaceId={workspaceId}
            today={today}
            onDone={() => setDraft(null)}
          />
        )}
      </Sheet>
    </EntrySheetContext.Provider>
  );
}


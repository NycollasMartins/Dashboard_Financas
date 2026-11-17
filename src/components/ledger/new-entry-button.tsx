"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEntrySheet, type EntryDraft } from "./entry-sheet";

export function NewEntryButton({ draft, label = "Novo lançamento" }: { draft?: EntryDraft; label?: string }) {
  const { open } = useEntrySheet();
  return (
    <Button type="button" onClick={() => open(draft)}>
      <Plus /> {label}
    </Button>
  );
}

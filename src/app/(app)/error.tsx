"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid justify-items-center gap-4 rounded-2xl border border-dashed px-6 py-16 text-center">
      <TriangleAlert className="size-8 text-warning" />
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Algo deu errado</h1>
        <p className="text-sm text-muted-foreground">Não conseguimos carregar esta tela. Tente novamente.</p>
      </div>
      <Button onClick={reset} variant="secondary">
        <RotateCcw /> Tentar de novo
      </Button>
    </div>
  );
}

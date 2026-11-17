import type { Metadata } from "next";
import { CreditCard } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Cartões" };

export default function Page() {
  return (
    <>
      <PageHeader title="Cartões" />
      <EmptyState icon={CreditCard} title="Chega na Fase 2" description="Cadastro de cartões com fechamento e vencimento, e faturas calculadas automaticamente." />
    </>
  );
}

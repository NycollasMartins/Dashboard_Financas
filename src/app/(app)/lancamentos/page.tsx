import type { Metadata } from "next";
import { ListOrdered } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Lançamentos" };

export default function Page() {
  return (
    <>
      <PageHeader title="Lançamentos" />
      <EmptyState icon={ListOrdered} title="Chega na Fase 2" description="Receitas, despesas, recorrências, parcelamentos e importação de extratos." />
    </>
  );
}

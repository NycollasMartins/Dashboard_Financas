import type { Metadata } from "next";
import { Target } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Metas" };

export default function Page() {
  return (
    <>
      <PageHeader title="Metas" />
      <EmptyState icon={Target} title="Chega na Fase 4" description="Objetivos com prazo, aportes e projeção de quanto falta e quando você chega lá." />
    </>
  );
}

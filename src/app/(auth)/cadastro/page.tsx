import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "../auth-card";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignUpPage() {
  return (
    <AuthCard
      title="Criar conta"
      description="Seu espaço pessoal é criado na hora. Depois você pode criar uma família e convidar quem quiser."
      footer={
        <>
          Já tem conta?{" "}
          <Link href="/entrar" className="font-medium text-primary underline-offset-4 hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <Suspense>
        <SignUpForm />
      </Suspense>
    </AuthCard>
  );
}

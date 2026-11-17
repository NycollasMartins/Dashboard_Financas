import type { Metadata } from "next";
import { ForgotPasswordForm } from "./form";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function Page() {
  return <ForgotPasswordForm />;
}

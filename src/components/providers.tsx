"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      themes={["dark", "light"]}
      enableSystem={false}
      disableTransitionOnChange
    >
      <TooltipProvider>{children}</TooltipProvider>
      <Toaster position="top-center" richColors closeButton />
    </ThemeProvider>
  );
}

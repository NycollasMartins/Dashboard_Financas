"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Folha (sheet): no celular sobe de baixo (zona do polegar) e respeita a safe
 * area; no desktop vira um painel centralizado. Baseada no Dialog do Base UI
 * (foco preso, Esc fecha, aria-modal).
 */
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({
  className,
  children,
  title,
  description,
  scroll = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  title: string;
  description?: React.ReactNode;
  /** false = o filho controla a rolagem (ex.: formulário com rodapé fixo). */
  scroll?: boolean;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
      <DialogPrimitive.Popup
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-3xl border-t bg-popover text-popover-foreground shadow-2xl outline-none",
          "pb-safe transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full",
          "sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[min(32rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:border",
          "sm:data-[ending-style]:translate-y-[-45%] sm:data-[ending-style]:opacity-0 sm:data-[starting-style]:translate-y-[-45%] sm:data-[starting-style]:opacity-0",
          className,
        )}
        {...props}
      >
        <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30 sm:hidden" />
        <div className="flex items-start justify-between gap-3 px-5 pt-3 pb-2 sm:pt-5">
          <div className="min-w-0">
            <DialogPrimitive.Title className="font-heading text-lg font-semibold">{title}</DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="text-sm text-muted-foreground">{description}</DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close
            className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Fechar"
          >
            <XIcon className="size-5" />
          </DialogPrimitive.Close>
        </div>
        {scroll ? (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        )}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

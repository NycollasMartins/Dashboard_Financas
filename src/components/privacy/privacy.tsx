"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { setHideAmountsAction } from "@/app/(app)/_actions/preferences";
import { cn } from "@/lib/utils";

/*
 * "Ocultar valores" (RN-67). O atributo data-privacy no contêiner faz o CSS
 * trocar todo <Money> por "R$ ••••"; gráficos leem `usePrivacy()` para
 * esconder eixos e tooltips. O valor inicial vem do perfil (renderizado no
 * servidor → sem piscar valores ao abrir o app).
 */
const PrivacyContext = createContext<{ hidden: boolean; toggle: () => void }>({ hidden: false, toggle: () => {} });

export function PrivacyProvider({ initialHidden, children }: { initialHidden: boolean; children: React.ReactNode }) {
  // Estado local: troca na hora; o servidor só guarda a preferência.
  const [hidden, setHidden] = useState(initialHidden);

  const toggle = useCallback(() => {
    const next = !hidden;
    setHidden(next);
    void setHideAmountsAction(next).then((res) => {
      if (res.status === "error") toast.error(res.message);
    });
  }, [hidden]);

  return (
    <PrivacyContext value={{ hidden, toggle }}>
      <div data-privacy={hidden ? "on" : "off"} className="contents">
        {children}
      </div>
    </PrivacyContext>
  );
}

export function usePrivacy() {
  return useContext(PrivacyContext);
}

export function PrivacyToggle({ className }: { className?: string }) {
  const { hidden, toggle } = usePrivacy();
  const Icon = hidden ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={hidden}
      aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}
      title={hidden ? "Mostrar valores" : "Ocultar valores"}
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        hidden && "text-primary",
        className,
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}

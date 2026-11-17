"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { switchWorkspaceAction } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";

export function SwitchToButton({ workspaceId }: { workspaceId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await switchWorkspaceAction(workspaceId);
          if (res.status === "error") toast.error(res.message);
        })
      }
    >
      Abrir <ArrowRight />
    </Button>
  );
}

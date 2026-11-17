"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { LogOut, Moon, Settings, Sun } from "lucide-react";
import { signOutAction } from "@/app/(auth)/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function initials(name: string, email: string) {
  const source = name.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase() || "?";
}

export function UserMenu({
  name,
  email,
  showDetails = false,
}: {
  name: string;
  email: string;
  showDetails?: boolean;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-3 rounded-xl p-1.5 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
          showDetails && "w-full",
        )}
        aria-label="Menu da conta"
      >
        <Avatar className="size-8">
          <AvatarFallback className="bg-surface-2 text-xs font-semibold">{initials(name, email)}</AvatarFallback>
        </Avatar>
        {showDetails && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{name || "Sem nome"}</span>
            <span className="block truncate text-xs text-muted-foreground">{email}</span>
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60" align="end" side={showDetails ? "top" : "bottom"}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuItem render={<Link href="/configuracoes" />}>
          <Settings /> Configurações
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme(isDark ? "light" : "dark")}>
          {isDark ? <Sun /> : <Moon />} Tema {isDark ? "claro" : "escuro"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => signOutAction()}>
          <LogOut /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
